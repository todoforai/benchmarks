"""
TODOforAI agent adapter for Harbor (Terminal-Bench 2.0).
"""

import asyncio
import hashlib
import json
import os
import shlex
import uuid
from pathlib import Path

from harbor.agents.installed.base import (
    AgentAuthenticationError,
    ApiError,
    BaseInstalledAgent,
    ErrorPattern,
    ModelNotFoundError,
    NetworkConnectionError,
    with_prompt_template,
)
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


def _load_api_key_pool() -> list[str]:
    """Priority: TODOFORAI_API_KEYS (comma-sep) > TODOFORAI_API_KEYS_FILE (first whitespace-separated token per line, # comments) > TODOFORAI_API_KEY."""
    multi = os.environ.get("TODOFORAI_API_KEYS", "").strip()
    if multi:
        return [k.strip() for k in multi.split(",") if k.strip()]
    path = os.environ.get("TODOFORAI_API_KEYS_FILE", "").strip()
    if path and Path(path).is_file():
        keys = []
        for line in Path(path).read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                keys.append(line.split()[0])
        if keys:
            return keys
    single = os.environ.get("TODOFORAI_API_KEY", "").strip()
    if single:
        return [single]
    # Fallback: the checked-in key file next to the adapter. Harbor 0.22 runs
    # trials without inheriting the launching shell's environment, so env-only
    # configuration silently yields an empty pool (edge then falls into the
    # interactive device-login flow and the trial dies).
    default_file = Path(__file__).resolve().parent.parent / "dev_api_keys.txt"
    if default_file.is_file():
        keys = []
        for line in default_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                keys.append(line.split()[0])
        if keys:
            return keys
    return [""]


def _api_url() -> str:
    """Resolve the backend URL the same way for preflight and trials.

    NOTE precedence: a shell `TODOFORAI_API_URL` beats the repo `.env`, because
    dotenv does not override real env vars. That mismatch (shell pointing at
    production, `.env` at local dev) silently 401'd every trial in a run — hence
    the preflight prints the resolved value.
    """
    return os.environ.get("TODOFORAI_API_URL", "").strip() or "https://api.todofor.ai"


def preflight(agent_name: str = "app") -> None:
    """Validate every credential before the first container starts.

    Costs seconds; a bad key or missing agent otherwise burns the whole job as
    reward-0 trials. Raises with an actionable message on the first failure.
    """
    import urllib.error
    import urllib.request

    url = _api_url()
    keys = _load_api_key_pool()
    if not any(keys):
        raise RuntimeError(
            "No API key configured. Set TODOFORAI_API_KEYS (comma-separated), "
            "TODOFORAI_API_KEYS_FILE, or TODOFORAI_API_KEY."
        )
    print(f"[preflight] api_url={url} keys={len(keys)}")
    for key in keys:
        req = urllib.request.Request(
            f"{url}/api/v1/agents", headers={"x-api-key": key}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                agents = json.loads(resp.read())
        except urllib.error.HTTPError as exc:
            raise RuntimeError(
                f"[preflight] key {key[:6]}… rejected by {url}: HTTP {exc.code}. "
                "Wrong backend for these keys, or key was deleted."
            ) from exc
        match = next((a for a in agents if a.get("name") == agent_name), None)
        if match is None:
            names = ", ".join(sorted(a.get("name", "?") for a in agents)) or "none"
            raise RuntimeError(
                f"[preflight] key {key[:6]}… has no agent named {agent_name!r} "
                f"(has: {names}). Create it before running the benchmark."
            )
        print(f"[preflight]   {key[:6]}… ok  agent={agent_name} model={match.get('model')}")


class _ApiKeyPool:
    """Shared across all trial instances. Ensures each key is held by at most
    one trial at a time → no MACHINE_ID collision (same key → same device)."""
    _queue: asyncio.Queue | None = None
    _lock = asyncio.Lock()

    @classmethod
    async def acquire(cls) -> str:
        async with cls._lock:
            if cls._queue is None:
                cls._queue = asyncio.Queue()
                for k in _load_api_key_pool():
                    cls._queue.put_nowait(k)
        return await cls._queue.get()

    @classmethod
    def release(cls, key: str) -> None:
        if cls._queue is not None:
            cls._queue.put_nowait(key)


class TODOforAIHarborAgent(BaseInstalledAgent):
    # Our failure surface. Without these, an infra failure (dead LLM auth, bad
    # API key, missing agent) is recorded as reward 0.0 with 0 exceptions —
    # i.e. counted as "the agent tried and got it wrong", which silently
    # depresses every score. Listed before the base patterns' generic
    # "API Error" catch-all; the LAST match in the list wins, so base
    # patterns stay authoritative for what they already classify.
    ERROR_PATTERNS = [
        *BaseInstalledAgent.ERROR_PATTERNS,
        # Backend LLM proxy has no usable provider auth/session.
        ErrorPattern(r"auth_unavailable", AgentAuthenticationError),
        ErrorPattern(r"API key invalid", AgentAuthenticationError),
        ErrorPattern(r"Not authenticated", AgentAuthenticationError),
        ErrorPattern(r"Starting device login", AgentAuthenticationError),
        # Bench agent profile missing on the account (provisioning drift).
        ErrorPattern(r"Agent '[^']*' not found", ModelNotFoundError),
        ErrorPattern(r"Model '[^']*' not found", ModelNotFoundError),
        # Device/daemon never came online, or dropped mid-run: no tool calls
        # could land, so the trial says nothing about agent capability.
        ErrorPattern(r"No edge connected", NetworkConnectionError),
        ErrorPattern(r"WebSocket (closed|disconnected)", NetworkConnectionError),
        # The todo ended in a non-success terminal state.
        ErrorPattern(r"Stopped: ERROR", ApiError),
    ]

    @staticmethod
    def name() -> str:
        return "todoforai"

    @property
    def _install_agent_template_path(self) -> Path:
        return Path(__file__).parent / "install-todoforai.sh.j2"

    def populate_context_post_run(self, context: AgentContext) -> None:
        pass

    async def install(self, environment: BaseEnvironment) -> None:
        install_script = Path(__file__).parent / "install-todoforai.sh.j2"
        await environment.upload_file(source_path=install_script, target_path="/installed-agent/install-todoforai.sh")
        await self.exec_as_root(
            environment,
            command="bash /installed-agent/install-todoforai.sh",
            env={"DEBIAN_FRONTEND": "noninteractive"},
        )

    # Stable, per-API-key machine-id so each account gets its own device.
    # Same API key → same device (dashboard stays clean, resume reuses edge).
    # Different API keys → different devices (enables parallel trials via key pool).
    MACHINE_ID_BASE = "todoforai-tb"

    @classmethod
    def _machine_id(cls, api_key: str) -> str:
        return hashlib.sha256(f"{cls.MACHINE_ID_BASE}:{api_key}".encode()).hexdigest()[:32]

    async def setup(self, environment: BaseEnvironment) -> None:
        # Lease an API key for this trial's entire lifetime. Released in run()'s finally.
        # Mutex semantics: same key can never be held by two trials concurrently.
        self._api_key = await _ApiKeyPool.acquire()
        machine_id = self._machine_id(self._api_key)
        await environment.exec(
            command=f"echo {machine_id} > /etc/machine-id", user="root",
        )
        # Prevent apt/dpkg from blocking on debconf prompts (e.g. tzdata) in agent shells.
        # /etc/environment for login shells; /root/.bashrc for interactive non-login bash -c.
        await environment.exec(
            command=(
                "echo 'DEBIAN_FRONTEND=noninteractive' >> /etc/environment && "
                "echo 'export DEBIAN_FRONTEND=noninteractive' >> /root/.bashrc"
            ),
            user="root",
        )
        dist_dir = Path(__file__).parent / "dist"
        if dist_dir.is_dir():
            await environment.exec(command="mkdir -p /installed-agent/dist")
            await environment.upload_dir(source_dir=dist_dir, target_dir="/installed-agent/dist")
        await super().setup(environment)

    @with_prompt_template
    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        api_key = self._api_key
        api_url = _api_url()
        # Credentials travel as env vars, never argv: harbor records the command
        # verbatim into trial.log/job.log/result.json, so a `--api-key` flag
        # publishes a live key into every committed job directory. Edge reads
        # TODOFORAI_API_KEY, the CLI reads TODOFORAI_API_TOKEN, both read
        # TODOFORAI_API_URL.
        # Edge 4ab0c3e dropped the TODOFORAI_API_KEY env var; the key must be
        # explicit via --api-key. Referencing the env VAR NAME in the command
        # keeps it out of harbor's verbatim command logs (expanded only by the
        # in-container shell); the value still travels via secret_env.
        edge_flags = ' --api-key "$TODOFORAI_API_KEY" --add-path /app --no-auto-update'
        cli_flags = ""
        # Pin the pre-configured benchmark agent by exact name. Path-based
        # matching (--path /app) races the edge's online registration: if the
        # backend hasn't seen the edge yet, no agent matches the workspace path
        # and the CLI auto-creates a fresh "app" agent with default model
        # "claude" and no devicesConfig -> tool calls go nowhere -> reward 0.
        cli_flags += " --agent app"
        # Model comes from the harbor command (-m), like claude-code/codex, so a
        # run is fully described by its invocation instead of by mutable
        # per-account state. Falls back to the account's configured model.
        if self.model_name:
            cli_flags += f" --model {shlex.quote(self.model_name)}"

        # Instruction travels via env var -> stdin (claude-code's approach):
        # no argv length limit and no quoting hazards for multi-line tasks.
        instr_var = f"TODOFORAI_INSTRUCTION_{uuid.uuid4().hex}"
        secret_env = {instr_var: instruction}
        if api_key:
            secret_env["TODOFORAI_API_KEY"] = api_key
            secret_env["TODOFORAI_API_TOKEN"] = api_key
        if api_url:
            secret_env["TODOFORAI_API_URL"] = api_url
        try:
            await self.exec_as_agent(
                environment,
                command=(
                    "mkdir -p /logs/agent && "
                    # Diagnostic: record whether the secret env arrived (lengths only).
                    'echo "key_len=${#TODOFORAI_API_KEY} token_len=${#TODOFORAI_API_TOKEN} url=$TODOFORAI_API_URL" > /logs/agent/envcheck.txt && '
                    f"todoforai-edge{edge_flags} > /logs/agent/edge.txt 2>&1 & "
                    # Poll for the daemon instead of a fixed sleep: a slow start
                    # used to mean the CLI ran before any device was online.
                    "for i in $(seq 1 30); do "
                    "  grep -q 'Connected edge=' /logs/agent/edge.txt 2>/dev/null && break; "
                    "  sleep 1; "
                    "done && "
                    f'printf "%s" "${instr_var}" | '
                    "todoforai-cli --non-interactive --allow-all --no-edge --path /app"
                    f"{cli_flags} 2>&1 | tee /logs/agent/todoforai-cli.txt"
                ),
                env=secret_env,
            )
        finally:
            # Kill leftover processes (edge, background apt-get from agent) so they
            # don't hold the dpkg lock or hijack tool calls for the next trial.
            # Runs even on agent timeout.
            try:
                await environment.exec(
                    command=(
                        "pkill -9 -f todoforai-edge 2>/dev/null; "
                        "pkill -9 -f todoforai-cli 2>/dev/null; "
                        "pkill -9 -f 'apt-get|^apt |dpkg' 2>/dev/null; "
                        "timeout 30 sh -c 'while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done'; "
                        "true"
                    ),
                    user="root",
                )
            finally:
                _ApiKeyPool.release(api_key)
