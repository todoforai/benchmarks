"""
TODOforAI agent adapter for Terminal-Bench.
"""

import os
import shlex
from pathlib import Path

from terminal_bench.agents.installed_agents.abstract_installed_agent import AbstractInstalledAgent
from terminal_bench.terminal.models import TerminalCommand


class TODOforAIAgent(AbstractInstalledAgent):
    @staticmethod
    def name() -> str:
        return "todoforai"

    @property
    def _env(self) -> dict[str, str]:
        env = {}
        if os.environ.get("TODOFORAI_API_KEY"):
            env["TODOFORAI_API_KEY"] = os.environ["TODOFORAI_API_KEY"]
        if os.environ.get("TODOFORAI_API_URL"):
            env["TODOFORAI_API_URL"] = os.environ["TODOFORAI_API_URL"]
        return env

    @property
    def _install_agent_script_path(self) -> Path:
        return Path(__file__).parent / "scripts" / "install.sh"

    def _run_agent_commands(self, instruction: str) -> list[TerminalCommand]:
        escaped = shlex.quote(instruction)
        return [
            TerminalCommand(
                command=f"echo {escaped} | /usr/local/bin/todoai-cli -y --timeout 600",
                max_timeout_sec=660.0,
                block=True,
            ),
        ]
