"""
TODOforAI agent adapter for Terminal-Bench.
"""

import os
import shlex
import threading
from pathlib import Path
from queue import Queue

import dotenv
from terminal_bench.agents.base_agent import AgentResult
from terminal_bench.agents.installed_agents.abstract_installed_agent import AbstractInstalledAgent
from terminal_bench.terminal.models import TerminalCommand
from terminal_bench.terminal.tmux_session import TmuxSession

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


class TODOforAIAgent(AbstractInstalledAgent):
    _key_pool: Queue | None = None
    _pool_initialized = False
    _pool_lock = threading.Lock()

    @classmethod
    def _init_pool(cls):
        with cls._pool_lock:
            if cls._pool_initialized:
                return
            keys = _load_keys()
            if keys:
                cls._key_pool = Queue()
                for key in keys:
                    cls._key_pool.put(key)
            cls._pool_initialized = True

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
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
    def _install_agent_script_path(self) -> Path:
        return Path(__file__).parent / "scripts" / "install.sh"

    def _run_agent_commands(self, instruction: str) -> list[TerminalCommand]:
        escaped = shlex.quote(instruction)
        api_url = os.environ.get("TODOFORAI_API_URL", "")
        url_flag = f" --api-url {shlex.quote(api_url)}" if api_url else ""
        project_id = os.environ.get("TODOFORAI_PROJECT_ID", "")
        project_flag = f" --project {shlex.quote(project_id)}" if project_id else ""
        return [
            TerminalCommand(
                command=f"echo {escaped} | /usr/local/bin/todoai-cli -y --agent Agent --edge /app --timeout 600{url_flag}{project_flag}",
                max_timeout_sec=660.0,
                block=True,
            ),
        ]

    def perform_task(
        self,
        instruction: str,
        session: TmuxSession,
        logging_dir: Path | None = None,
    ) -> AgentResult:
        if self._key_pool is not None:
            # Blocks until a key is available — naturally throttles concurrency
            # to the number of keys in the pool
            self._current_key = self._key_pool.get()
        try:
            return super().perform_task(instruction, session, logging_dir)
        finally:
            if self._current_key is not None:
                self._key_pool.put(self._current_key)
                self._current_key = None
