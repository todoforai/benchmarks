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
    AgentSafetyRefusalError,
    ApiError,
    BaseInstalledAgent,
    ErrorPattern,
    ModelNotFoundError,
    NetworkConnectionError,
    NonZeroAgentExitCodeError,
    with_prompt_template,
)
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


def _api_key() -> str:
    """One account for every trial: mayfly sessions are todo-scoped, so parallel
    trials don't collide. TODOFORAI_API_KEY > first key in dev_api_keys.txt
    (Harbor 0.22 runs trials without inheriting the launching shell's env)."""
    key = os.environ.get("TODOFORAI_API_KEY", "").strip()
    if key:
        return key
    f = Path(__file__).resolve().parent.parent / "dev_api_keys.txt"
    if f.is_file():
        for line in f.read_text().splitlines():
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


def _cpu_limit_prefix(cpus) -> tuple[str, str]:
    """Make the task's CPU limit visible inside the container, no prompt change.

    harbor sets only a docker CPU *quota* (task.toml `cpus`, 1 for 83/89 tasks),
    so `nproc` still reports every host core (64): the model ran
    `xargs -P $(nproc)` = 64 tesseracts on 1 CPU (extract-moves 0928).
    `taskset` makes nproc / make -j$(nproc) / xargs -P see N; OMP_NUM_THREADS
    caps OpenMP libs (tesseract, numpy). The cores are a random window so
    concurrent trials don't all land on core 0; the quota still does the limiting.
    Returns (env prefix for the CLI, shell snippet setting $TFA_PIN).
    """
    try:
        n = int(cpus)
    except (TypeError, ValueError):
        return "", ""
    if n < 1:
        return "", ""
    pin = (
        "TFA_PIN=; if command -v taskset >/dev/null 2>&1; then "
        "T=$(nproc); S=$(( $(od -An -N2 -tu2 /dev/urandom) % T )); L=; i=0; "
        f"while [ $i -lt {n} ] && [ $i -lt $T ]; do L=$L${{L:+,}}$(( (S + i) % T )); i=$((i + 1)); done; "
        'TFA_PIN="taskset -c $L"; fi; '
        f'echo "cpus={n} pin=$TFA_PIN" > /logs/agent/cpus.txt; '
    )
    return f"OMP_NUM_THREADS={n} ", pin


# bullseye (EOL) -security pool drops superseded debs (404) while its index
# still lists them, so any `apt-get install` pulling a security update fails.
_DROP_EOL_SECURITY = (
    "sed -i '/bullseye-security/s/^deb /# deb /' /etc/apt/sources.list "
    "$(ls /etc/apt/sources.list.d/*.list 2>/dev/null) 2>/dev/null; true"
)


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
            "No API key configured. Set TODOFORAI_API_KEY or put `<key> <email>` "
            "in dev_api_keys.txt."
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


_REFUSAL_RE = r"refused to answer this request|flagged as: cyber"


def _refusal_reason(cli_log: Path) -> str | None:
    """The todo's error-block text if the run ended in a model refusal.

    The CLI prints only `Stopped: ERROR`; the refusal ("`claude-opus-5-5`
    refused to answer this request (flagged as: cyber)") lives in the todo's
    last assistant message. Without this it classified as ApiError and was
    retried as infra (kv-live-surgery, TB4 mini sweep 2026-10-03).
    """
    import re
    import urllib.request

    try:
        m = re.search(r"todofor\.ai/t/([0-9a-f-]{36})", cli_log.read_text(errors="replace"))
        if not m:
            return None
        req = urllib.request.Request(
            f"{_api_url()}/api/v1/todos/{m.group(1)}/messages",
            headers={"x-api-key": _api_key()},
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            msgs = json.loads(resp.read())
        msgs = msgs if isinstance(msgs, list) else msgs.get("messages", [])
        last = next((x for x in reversed(msgs) if x.get("role") == "assistant"), {})
        for block in last.get("blocks") or []:
            err = block.get("error_message") or ""
            if block.get("type") == "error" and re.search(_REFUSAL_RE, err, re.I):
                return err
    except Exception:
        return None
    return None


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
        # Provider safety refusal = model outcome, not infra -> never retried
        # (--retry-include matches exact type names). The CLI itself prints only
        # "Stopped: ERROR"; run() upgrades via _refusal_reason().
        ErrorPattern(_REFUSAL_RE, AgentSafetyRefusalError),
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
        cpu_env, cpu_pin = _cpu_limit_prefix(getattr(getattr(environment, "task_env_config", None), "cpus", None))
        try:
            await self.exec_as_agent(
                environment,
                command=(
                    "mkdir -p /logs/agent && "
                    f"{cpu_pin}"
                    # Diagnostic: record whether the secret env arrived (lengths only).
                    'echo "token_len=${#TODOFORAI_API_TOKEN} url=$TODOFORAI_API_URL" > /logs/agent/envcheck.txt && '
                    f'printf "%s" "${instr_var}" | '
                    # Workspace = the image's WORKDIR (harbor execs there); 119/120
                    # tasks use /app, prove-plus-comm uses /workspace.
                    # The bridge (and every agent PTY) inherits the CLI's env;
                    # its /bin/sh reads neither /etc/environment nor .bashrc,
                    # so setup()'s DEBIAN_FRONTEND only takes effect here.
                    "DEBIAN_FRONTEND=noninteractive "
                    f"{cpu_env}"
                    '$TFA_PIN todoforai-cli --isolated --non-interactive --allow-all --path "$PWD"'
                    f"{cli_flags} 2>&1 | tee /logs/agent/todoforai-cli.txt"
                ),
                env=secret_env,
            )
        except NonZeroAgentExitCodeError as exc:
            if not isinstance(exc, AgentSafetyRefusalError):
                reason = _refusal_reason(Path(self.logs_dir) / "todoforai-cli.txt")
                if reason:
                    raise AgentSafetyRefusalError(f"{reason}\n{exc}") from exc
            raise
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
            # Verifier prerequisite, after the agent (agent's env untouched): the
            # qemu-* test.sh (debian:bullseye-slim) `apt-get install curl sshpass
            # expect` hits 404'd -security debs -> no curl/uvx/sshpass -> reward 0
            # no matter what the agent did (all Opus 5.5 qemu runs, 09-25..30).
            await environment.exec(command=_DROP_EOL_SECURITY, user="root")
