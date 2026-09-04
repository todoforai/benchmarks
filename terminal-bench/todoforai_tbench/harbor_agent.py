"""
TODOforAI agent adapter for Harbor (Terminal-Bench 2.0).

One command per trial: `tfa-cli --isolated`. The CLI trades the API key for a
short-lived todo-scoped token (cli.mayfly.token), spawns todoforai-bridge as an
ephemeral in-memory session (`mayfly-<todoId>`, no Device row), waits for
BRIDGE_READY, runs the task, and the session evaporates with the process.

Because every trial registers under its own mayfly-<todoId> slot, one account
runs any number of trials in parallel — no key pool, no per-key machine-id, no
daemon startup/polling, no cross-trial device collisions.
"""

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


def _api_key() -> str:
    """Single key: mayfly sessions are todo-scoped, so parallel trials no longer
    need distinct accounts. TODOFORAI_API_KEY > first key in
    TODOFORAI_API_KEYS/-_FILE (backwards compat) > checked-in dev_api_keys.txt
    (Harbor 0.22 runs trials without inheriting the launching shell's env)."""
    single = os.environ.get("TODOFORAI_API_KEY", "").strip()
    if single:
        return single
    multi = os.environ.get("TODOFORAI_API_KEYS", "").strip()
    if multi:
        return multi.split(",")[0].strip()
    for p in (os.environ.get("TODOFORAI_API_KEYS_FILE", "").strip(),
              str(Path(__file__).resolve().parent.parent / "dev_api_keys.txt")):
        if p and Path(p).is_file():
            for line in Path(p).read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#"):
                    return line.split()[0]
    return ""


def _api_url() -> str:
    """Resolve the backend URL the same way for preflight and trials.

    NOTE precedence: a shell `TODOFORAI_API_URL` beats the repo `.env`, because
    dotenv does not override real env vars. That mismatch (shell pointing at
    production, `.env` at local dev) silently 401'd every trial in a run — hence
    the preflight prints the resolved value.
    """
    return os.environ.get("TODOFORAI_API_URL", "").strip() or "https://api.todofor.ai"


def preflight(agent_name: str = "app") -> None:
    """Validate the credential before the first container starts.

    Costs seconds; a bad key or missing agent otherwise burns the whole job as
    reward-0 trials. Raises with an actionable message on the first failure.
    """
    import urllib.error
    import urllib.request

    url = _api_url()
    key = _api_key()
    if not key:
        raise RuntimeError(
            "No API key configured. Set TODOFORAI_API_KEY (or TODOFORAI_API_KEYS / "
            "TODOFORAI_API_KEYS_FILE)."
        )
    print(f"[preflight] api_url={url}")
    req = urllib.request.Request(f"{url}/api/v1/agents", headers={"x-api-key": key})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            agents = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise RuntimeError(
            f"[preflight] key {key[:6]}… rejected by {url}: HTTP {exc.code}. "
            "Wrong backend for this key, or key was deleted."
        ) from exc
    match = next((a for a in agents if a.get("name") == agent_name), None)
    if match is None:
        names = ", ".join(sorted(a.get("name", "?") for a in agents)) or "none"
        raise RuntimeError(
            f"[preflight] key {key[:6]}… has no agent named {agent_name!r} "
            f"(has: {names}). Create it before running the benchmark."
        )
    print(f"[preflight]   {key[:6]}… ok  agent={agent_name} model={match.get('model')}")


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
        ErrorPattern(r"could not mint a session token", AgentAuthenticationError),
        # Bench agent profile missing on the account (provisioning drift).
        ErrorPattern(r"Agent '[^']*' not found", ModelNotFoundError),
        ErrorPattern(r"Model '[^']*' not found", ModelNotFoundError),
        # The isolated bridge never came up (or died): no tool calls could
        # land, so the trial says nothing about agent capability.
        ErrorPattern(r"Isolated bridge (not ready|exited early)", NetworkConnectionError),
        ErrorPattern(r"session token rejected", NetworkConnectionError),
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

    async def setup(self, environment: BaseEnvironment) -> None:
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
        api_key = _api_key()
        api_url = _api_url()
        # Pin the pre-configured benchmark agent by exact name — path-based
        # matching would auto-create a fresh "app" agent with a default model.
        cli_flags = " --agent app"
        # Model comes from the harbor command (-m), like claude-code/codex, so a
        # run is fully described by its invocation instead of by mutable
        # per-account state. Falls back to the account's configured model.
        if self.model_name:
            cli_flags += f" --model {shlex.quote(self.model_name)}"

        # Instruction travels via env var -> stdin (claude-code's approach):
        # no argv length limit and no quoting hazards for multi-line tasks.
        # Credentials travel as env vars, never argv: harbor records the command
        # verbatim into trial.log/job.log/result.json, so a flag would publish a
        # live key into every committed job directory. The CLI reads
        # TODOFORAI_API_TOKEN, trades it for a todo-scoped session token, and
        # strips the durable key from the bridge's environment itself.
        instr_var = f"TODOFORAI_INSTRUCTION_{uuid.uuid4().hex}"
        secret_env = {instr_var: instruction}
        if api_key:
            secret_env["TODOFORAI_API_TOKEN"] = api_key
        if api_url:
            secret_env["TODOFORAI_API_URL"] = api_url
        try:
            await self.exec_as_agent(
                environment,
                command=(
                    "mkdir -p /logs/agent && "
                    # Diagnostic: record whether the secret env arrived (lengths only).
                    'echo "token_len=${#TODOFORAI_API_TOKEN} url=$TODOFORAI_API_URL" > /logs/agent/envcheck.txt && '
                    f'printf "%s" "${instr_var}" | '
                    # Workspace = the image's WORKDIR (harbor execs there); 119/120
                    # tasks use /app, prove-plus-comm uses /workspace.
                    'todoforai-cli --isolated --non-interactive --allow-all --path "$PWD"'
                    f"{cli_flags} 2>&1 | tee /logs/agent/todoforai-cli.txt"
                ),
                env=secret_env,
            )
        finally:
            # Kill leftovers (bridge if the CLI died hard, background apt from the
            # agent) so they don't hold the dpkg lock or linger into the next
            # trial. Runs even on agent timeout.
            await environment.exec(
                command=(
                    "pkill -9 -f todoforai-bridge 2>/dev/null; "
                    "pkill -9 -f todoforai-cli 2>/dev/null; "
                    "pkill -9 -f 'apt-get|^apt |dpkg' 2>/dev/null; "
                    "timeout 30 sh -c 'while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done'; "
                    "true"
                ),
                user="root",
            )
