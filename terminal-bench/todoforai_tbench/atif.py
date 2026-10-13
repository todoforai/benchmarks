"""TODOforAI todo conversation -> ATIF trajectory (Harbor leaderboard format).

The backend conversation is the ground truth for what the agent did: user
message, then per assistant message the model's text, its tool calls (blocks
with a `toolCallId`) and their outputs (stored as attachments). Sub-agents
(explore/review/webfetch) run in their own todo (`subTodoId`) and become
embedded `subagent_trajectories`, so a judge sees every model that ran.

Token fields: our `inputTokens` excludes cache reads, so prompt_tokens =
input + cacheRead + cacheWrite (Harbor's claude-code convention). cost_usd is
what the backend billed, which includes promotional pricing.
"""

import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Callable

from harbor.models.trajectories import (
    Agent,
    FinalMetrics,
    Metrics,
    Observation,
    ObservationResult,
    Step,
    SubagentTrajectoryRef,
    ToolCall,
    Trajectory,
)

MAX_SUB_DEPTH = 5
# Block fields that are bookkeeping, not tool arguments (used only when the
# result doesn't carry the model's original `arguments`).
_NOT_ARGS = {
    "id", "type", "status", "generationCompleted", "runMeta", "userId", "toolCallId",
    "deviceId", "results", "result", "runMode", "title", "subTodoId", "subTodoIds",
    "attachments", "parentBlockId", "createdAt", "updatedAt", "todoId", "messageId",
    "cdp_url", "cdp_token",
}
# Trajectories are uploaded publicly: mask credentials the agent saw or typed.
_SECRET_RE = re.compile(
    r"(?i)((?:api[_-]?key|token|secret|password|authorization)[\"']?\s*[:=]\s*[\"']?(?:Bearer\s+)?)[^\s\"'&,]{8,}"
    r"|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})"
)


def redact(text: str) -> str:
    return _SECRET_RE.sub(lambda m: (m.group(1) or "") + "[REDACTED]", text)

Fetch = Callable[[str], str | None]  # attachment id -> text


def api_get(url: str, key: str, timeout: int = 60, tries: int = 3) -> bytes:
    req = urllib.request.Request(url, headers={"x-api-key": key})
    for i in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code < 500 or i == tries - 1:
                raise
        except OSError:
            if i == tries - 1:
                raise
        time.sleep(2 ** i)
    raise AssertionError("unreachable")


def fetch_messages(api_url: str, key: str, todo_id: str) -> list[dict]:
    """Whole conversation, oldest first (the endpoint pages newest-first via `before`)."""
    pages: list[list[dict]] = []
    before = None
    while True:
        q = f"limit=200&before={before}" if before else "limit=200"
        d = json.loads(api_get(f"{api_url}/api/v1/todos/{todo_id}/messages?{q}", key))
        msgs = d if isinstance(d, list) else d.get("messages", [])
        pages.append(msgs)
        if not (isinstance(d, dict) and d.get("hasMore") and msgs):
            break
        before = msgs[0]["id"]
    return [m for page in reversed(pages) for m in page]


def attachment_fetcher(api_url: str, key: str) -> Fetch:
    def fetch(att_id: str) -> str | None:
        try:
            return api_get(f"{api_url}/api/v1/resources/attachments/{att_id}", key).decode("utf-8", "replace")
        except Exception:
            return None
    return fetch


def _iso(ms) -> str | None:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat() if ms else None


def _metrics(msg: dict) -> Metrics | None:
    metas = [r for r in msg.get("runMeta") or [] if r.get("extras", {}).get("outputTokens") is not None]
    if not metas:
        return None
    s = lambda k: sum(r["extras"].get(k) or 0 for r in metas)
    cache_read = s("cacheReadTokens")
    return Metrics(
        prompt_tokens=s("inputTokens") + cache_read + s("cacheWriteTokens"),
        completion_tokens=s("outputTokens"),
        cached_tokens=cache_read,
        cost_usd=sum(r.get("cost") or 0 for r in metas),
    )


def _model(msg: dict) -> str | None:
    return next((r["extras"]["model"] for r in msg.get("runMeta") or [] if r.get("extras", {}).get("model")), None)


def _sub_ids(block: dict) -> list[str]:
    ids = list(block.get("subTodoIds") or [])
    if block.get("subTodoId") and block["subTodoId"] not in ids:
        ids.insert(0, block["subTodoId"])
    return ids


def _arguments(block: dict) -> dict:
    for res in block.get("results") or []:
        args = (res.get("meta") or {}).get("arguments")
        if isinstance(args, dict):
            return args
    return {k: v for k, v in block.items() if k not in _NOT_ARGS and v not in ("", None)}


def _observation(block: dict, fetch: Fetch) -> str:
    parts = []
    for res in block.get("results") or []:
        meta = res.get("meta") or {}
        if meta.get("text"):
            parts.append(meta["text"])
        for att in res.get("attachments") or []:
            text = fetch(att["id"]) if att.get("id") else None
            parts.append(text if text is not None else f"[attachment {att.get('originalName', att.get('id'))} unavailable]")
        if meta.get("error"):
            parts.append(f"[error] {meta['error']}")
    if block.get("error_message"):
        parts.append(f"[error] {block['error_message']}")
    return redact("\n".join(parts))


def to_trajectory(
    messages: list[dict],
    fetch: Fetch,
    agent_version: str,
    model_name: str | None = None,
    session_id: str | None = None,
    load_sub: Callable[[str], list[dict] | None] | None = None,
    _depth: int = 0,
) -> Trajectory:
    """Raises if the conversation has no steps. Missing attachments or sub-agent
    todos are recorded in-place ("unavailable") so incompleteness is visible."""
    steps: list[Step] = []
    subs: list[Trajectory] = []
    seen_subs: set[str] = set()
    for msg in messages:
        blocks = msg.get("blocks") or []
        if msg.get("role") != "assistant":
            if (msg.get("content") or "").strip():
                steps.append(Step(step_id=len(steps) + 1, timestamp=_iso(msg.get("createdAt")),
                                  source="system" if msg.get("role") == "system" else "user",
                                  message=redact(msg["content"])))
            continue
        text = "\n\n".join(b.get("content") or "" for b in blocks if b.get("type") == "text").strip()
        errors = [b["error_message"] for b in blocks if b.get("type") == "error" and b.get("error_message")]
        calls, results = [], []
        for b in blocks:
            if not b.get("toolCallId"):
                continue
            args = json.loads(redact(json.dumps(_arguments(b))))
            calls.append(ToolCall(tool_call_id=b["toolCallId"], function_name=b.get("type", "tool"), arguments=args))
            content, refs = _observation(b, fetch), []
            for sid in _sub_ids(b) if load_sub else []:
                sub_msgs = load_sub(sid) if _depth < MAX_SUB_DEPTH and sid not in seen_subs else None
                if not sub_msgs:
                    content += f"\n[sub-agent todo {sid} unavailable]"
                    continue
                seen_subs.add(sid)
                subs.append(to_trajectory(sub_msgs, fetch, agent_version, None, sid, load_sub, _depth + 1)
                            .model_copy(update={"trajectory_id": sid}))
                refs.append(SubagentTrajectoryRef(trajectory_id=sid))
            results.append(ObservationResult(source_call_id=b["toolCallId"], content=content,
                                             subagent_trajectory_ref=refs or None))
        message = redact("\n\n".join([text] + [f"[error] {e}" for e in errors]).strip())
        if not (message or calls):
            continue
        steps.append(Step(
            step_id=len(steps) + 1,
            timestamp=_iso(msg.get("createdAt")),
            source="agent",
            model_name=_model(msg),
            message=message,
            tool_calls=calls or None,
            observation=Observation(results=results) if results else None,
            metrics=_metrics(msg),
        ))
    if not steps:
        raise ValueError("conversation has no steps")

    own = [s.metrics for s in steps if s.metrics]
    totals = own + [s.final_metrics for s in subs if s.final_metrics]
    pick = lambda m, a, b: getattr(m, a, None) if isinstance(m, Metrics) else getattr(m, b, None)
    total = lambda a, b: sum(pick(m, a, b) or 0 for m in totals)
    return Trajectory(
        schema_version="ATIF-v1.7",
        session_id=session_id,
        agent=Agent(name="todoforai", version=agent_version,
                    model_name=model_name or next((s.model_name for s in steps if s.model_name), None)),
        steps=steps,
        subagent_trajectories=subs or None,
        final_metrics=FinalMetrics(
            total_prompt_tokens=total("prompt_tokens", "total_prompt_tokens"),
            total_completion_tokens=total("completion_tokens", "total_completion_tokens"),
            total_cached_tokens=total("cached_tokens", "total_cached_tokens"),
            total_cost_usd=total("cost_usd", "total_cost_usd"),
            total_steps=len(steps),
            extra={"cost_basis": "billed by TODOforAI backend, includes promotional pricing; sub-agents included"},
        ),
    )
