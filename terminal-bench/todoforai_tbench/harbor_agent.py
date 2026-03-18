"""
TODOforAI agent adapter for Harbor (Terminal-Bench 2.0).
"""

import os
import shlex
import threading
from pathlib import Path
from queue import Queue

import dotenv
from harbor.agents.installed.base import BaseInstalledAgent, ExecInput
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

# terminal-bench's load_dotenv() searches from site-packages, not cwd.
# Load from cwd so users can put keys in .env next to their project.
dotenv.load_dotenv(dotenv.find_dotenv(usecwd=True))


def _load_keys() -> list[str]:
    """Load API keys from environment. Supports:
    - TODOFORAI_API_KEYS: comma-separated list
    - TODOFORAI_API_KEYS_FILE: path to file with one key per line
    - TODOFORAI_API_KEY: single key fallback
    """
    keys_str = os.environ.get("TODOFORAI_API_KEYS", "")
    if keys_str:
        return [k.strip() for k in keys_str.split(",") if k.strip()]

    keys_file = os.environ.get("TODOFORAI_API_KEYS_FILE", "")
    if keys_file:
        path = Path(keys_file)
        if path.exists():
            return [k.strip() for k in path.read_text().splitlines() if k.strip()]

    single = os.environ.get("TODOFORAI_API_KEY", "")
    if single:
        return [single]

    return []


class TODOforAIHarborAgent(BaseInstalledAgent):
    _key_pool: Queue | None = None
    _pool_initialized = False
    _pool_lock = threading.Lock()

    @classmethod
    def _init_pool(cls):
        with cls._pool_lock:
            if cls._pool_initialized:
                return
            keys = _load_keys()
            if not keys:
                raise RuntimeError(
                    "No TODOforAI API keys configured. Set one of:\n"
                    "  TODOFORAI_API_KEYS=key1,key2,...  (comma-separated, for concurrent runs)\n"
                    "  TODOFORAI_API_KEYS_FILE=/path/to/keys.txt  (one key per line)\n"
                    "  TODOFORAI_API_KEY=<key>  (single key)\n"
                    "Or create a .env file in the current directory with these variables.\n"
                    "To generate dev keys: ./scripts/create_dev_accounts.sh"
                )
            cls._key_pool = Queue()
            for key in keys:
                cls._key_pool.put(key)
            cls._pool_initialized = True

    def __init__(self, logs_dir: Path, *args, **kwargs):
        super().__init__(logs_dir, *args, **kwargs)
        self._init_pool()
        self._current_key: str | None = None

    @staticmethod
    def name() -> str:
        return "todoforai"

    @property
    def _env(self) -> dict[str, str]:
        env = {}
        if self._current_key:
            env["TODOFORAI_API_KEY"] = self._current_key
        if os.environ.get("TODOFORAI_API_URL"):
            env["TODOFORAI_API_URL"] = os.environ["TODOFORAI_API_URL"]
        if os.environ.get("TODOFORAI_PROJECT_ID"):
            env["TODOFORAI_PROJECT_ID"] = os.environ["TODOFORAI_PROJECT_ID"]
        return env

    @property
    def _install_agent_template_path(self) -> Path:
        return Path(__file__).parent / "install-todoforai.sh.j2"

    def create_run_agent_commands(self, instruction: str) -> list[ExecInput]:
        escaped = shlex.quote(instruction)
        api_url = os.environ.get("TODOFORAI_API_URL", "")
        url_flag = f" --api-url {shlex.quote(api_url)}" if api_url else ""
        project_flag = f" --project {shlex.quote(os.environ['TODOFORAI_PROJECT_ID'])}" if os.environ.get("TODOFORAI_PROJECT_ID") else ""
        edge_url_flag = f" --api-url {shlex.quote(api_url)}" if api_url else ""
        return [
            ExecInput(
                command=f"export PATH=\"$HOME/.bun/bin:$PATH\" && todoforai-edge --path /app{edge_url_flag} & sleep 2 && echo {escaped} | todoai --non-interactive --dangerously-skip-permissions --agent Agent --path /app{url_flag}{project_flag}",
                env=self._env,
                timeout_sec=660,
            ),
        ]

    def populate_context_post_run(self, context: AgentContext) -> None:
        pass

    async def setup(self, environment: BaseEnvironment) -> None:
        # Upload wheels before install so the script finds them
        wheels_dir = Path(__file__).parent / "wheels"
        if wheels_dir.is_dir() and list(wheels_dir.glob("*.whl")):
            await environment.exec(command="mkdir -p /installed-agent/wheels")
            await environment.upload_dir(
                source_dir=wheels_dir,
                target_dir="/installed-agent/wheels",
            )

        # Run the standard install (renders template, uploads, executes)
        await super().setup(environment)

    async def run(
        self,
        instruction: str,
        environment: BaseEnvironment,
        context: AgentContext,
    ) -> None:
        self._current_key = self._key_pool.get()
        try:
            await super().run(instruction, environment, context)
        finally:
            self._key_pool.put(self._current_key)
            self._current_key = None
