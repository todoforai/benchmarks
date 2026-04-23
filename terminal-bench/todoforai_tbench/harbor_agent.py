"""
TODOforAI agent adapter for Harbor (Terminal-Bench 2.0).
"""

import asyncio
import hashlib
import os
import shlex
from pathlib import Path

from harbor.agents.installed.base import BaseInstalledAgent, with_prompt_template
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
    return [single] if single else [""]


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
        api_url = os.environ.get("TODOFORAI_API_URL", "")
        edge_flags = f" --api-key {shlex.quote(api_key)}" if api_key else ""
        if api_url:
            edge_flags += f" --api-url {shlex.quote(api_url)}"
        edge_flags += " --add-path /app"
        todoai_flags = f" --api-key {shlex.quote(api_key)}" if api_key else ""
        if api_url:
            todoai_flags += f" --api-url {shlex.quote(api_url)}"

        try:
            await self.exec_as_agent(
                environment,
                command=(
                    f"todoforai-edge{edge_flags} & sleep 5 && "
                    f"echo {shlex.quote(instruction)} | todoai --non-interactive --allow-all --path /app{todoai_flags}"
                ),
            )
        finally:
            # Kill leftover processes (edge, background apt-get from agent) so they
            # don't hold the dpkg lock or hijack tool calls for the next trial.
            # Runs even on agent timeout.
            try:
                await environment.exec(
                    command=(
                        "pkill -9 -f todoforai-edge 2>/dev/null; "
                        "pkill -9 -f todoai 2>/dev/null; "
                        "pkill -9 -f 'apt-get|^apt |dpkg' 2>/dev/null; "
                        "timeout 30 sh -c 'while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do sleep 1; done'; "
                        "true"
                    ),
                    user="root",
                )
            finally:
                _ApiKeyPool.release(api_key)
