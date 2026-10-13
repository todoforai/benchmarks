"""ATIF conversion against a real archived trial conversation (bn-fit-modify, review-on run)."""

import json
from pathlib import Path

from harbor.models.trajectories import Trajectory

from todoforai_tbench.atif import redact, to_trajectory

FIXTURE = json.loads((Path(__file__).parent / "fixture_messages.json").read_text())
MESSAGES = FIXTURE["messages"] if isinstance(FIXTURE, dict) else FIXTURE


def _traj(**kw):
    return to_trajectory(MESSAGES, fetch=lambda att_id: f"out:{att_id}", agent_version="test", **kw)


def test_valid_atif_roundtrip():
    t = _traj(session_id="0cb422cd")
    assert t.schema_version == "ATIF-v1.7"
    Trajectory.model_validate(t.to_json_dict())  # what the leaderboard CI re-parses


def test_steps_and_tool_calls():
    t = _traj()
    assert t.steps[0].source == "user" and "Bayesian Network" in t.steps[0].message
    calls = [c for s in t.steps for c in s.tool_calls or []]
    assert {c.function_name for c in calls} >= {"bash", "read", "explore", "review"}
    bash = next(c for c in calls if c.function_name == "bash")
    assert "cmd" in bash.arguments and "userId" not in bash.arguments
    obs = {r.source_call_id: r.content for s in t.steps if s.observation for r in s.observation.results}
    assert set(obs) == {c.tool_call_id for c in calls}
    assert obs[bash.tool_call_id].startswith("out:")
    assert "Completed." in t.steps[-1].message


def test_metrics_include_cache_reads():
    t = _traj()
    fm = t.final_metrics
    assert fm.total_cached_tokens > 0
    assert fm.total_prompt_tokens > fm.total_cached_tokens
    assert 0 < fm.total_cost_usd < 1
    assert t.agent.model_name.startswith("openai:openai/gpt-5.6-sol")


def test_subagents_embedded():
    sub = [{"role": "user", "content": "review this"},
           {"role": "assistant", "blocks": [{"type": "text", "content": "looks fine"}],
            "runMeta": [{"cost": 0.5, "extras": {"model": "anthropic:claude-opus-5", "inputTokens": 10, "outputTokens": 5}}]}]
    t = _traj(load_sub=lambda tid: sub)
    assert t.subagent_trajectories and len(t.subagent_trajectories) == 2  # explore + review
    refs = [r.subagent_trajectory_ref for s in t.steps if s.observation for r in s.observation.results if r.subagent_trajectory_ref]
    assert {r[0].trajectory_id for r in refs} == {s.trajectory_id for s in t.subagent_trajectories}
    assert t.final_metrics.total_cost_usd > _traj().final_metrics.total_cost_usd  # sub-agent cost counted
    Trajectory.model_validate(t.to_json_dict())


def test_bash_spawned_subagents_and_secrets():
    msgs = [
        {"role": "user", "content": "go"},
        {"role": "assistant", "blocks": [
            {"type": "bash", "toolCallId": "c1", "cmd": "curl -H 'x-api-key: abcdef1234567890' x", "pid": 7,
             "subTodoIds": ["s1", "s2"], "results": [{"meta": {"text": "token=supersecretvalue"}}]},
            {"type": "open_browser", "toolCallId": "c2", "url": "https://a", "cdp_url": "wss://x?token=zzz"},
        ]},
    ]
    sub = [{"role": "user", "content": "sub task"}]
    t = to_trajectory(msgs, fetch=lambda _: None, agent_version="t",
                      load_sub=lambda sid: sub if sid == "s1" else None)
    dumped = json.dumps(t.to_json_dict())
    assert "abcdef1234567890" not in dumped and "supersecretvalue" not in dumped and "cdp_url" not in dumped
    assert t.steps[1].tool_calls[0].arguments["pid"] == 7
    obs = t.steps[1].observation.results[0]
    assert [r.trajectory_id for r in obs.subagent_trajectory_ref] == ["s1"]
    assert "[sub-agent todo s2 unavailable]" in obs.content


def test_redact_keeps_normal_text():
    assert redact("tokens used: 5000, see token budget") == "tokens used: 5000, see token budget"
    assert redact("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx") == "OPENAI_API_KEY=[REDACTED]"
