"""
TODOforAI AbstractInstalledAgent implementation for Terminal-Bench.

This variant installs todoai-cli into the benchmark container and
runs it as a subprocess. Best for leaderboard submissions where
the agent needs to run in an isolated environment.
"""

import os
from pathlib import Path
from typing import List, Dict, Optional

# Terminal-Bench imports
try:
    from terminal_bench.agents.installed_agents.abstract_installed_agent import AbstractInstalledAgent, TerminalCommand
except ImportError:
    # Allow importing without terminal-bench installed
    AbstractInstalledAgent = object
    TerminalCommand = None

from .config import TBenchConfig, load_config


class TODOforAIInstalledAgent(AbstractInstalledAgent):
    """
    TODOforAI agent that installs via setup script.

    This agent:
    1. Copies an installation script into the task container
    2. Installs Python, pip, and todoai-cli
    3. Runs todoai-cli with the task description

    Best for: Leaderboard submissions, isolated evaluation
    """

    def __init__(self, config: Optional[TBenchConfig] = None, **kwargs):
        super().__init__(**kwargs)
        self.config = config or load_config()

    @staticmethod
    def name() -> str:
        return "todoforai-installed"

    @property
    def _install_agent_script_path(self) -> Path:
        """Path to the installation script."""
        return Path(__file__).parent / "scripts" / "install.sh"

    @property
    def _env(self) -> Dict[str, str]:
        """Environment variables for the agent."""
        env = {}

        # API keys
        if os.environ.get("ANTHROPIC_API_KEY"):
            env["ANTHROPIC_API_KEY"] = os.environ["ANTHROPIC_API_KEY"]
        if os.environ.get("OPENAI_API_KEY"):
            env["OPENAI_API_KEY"] = os.environ["OPENAI_API_KEY"]

        # TODOforAI config - adjust localhost for Docker networking
        api_url = self.config.api_url
        if api_url and "localhost" in api_url:
            # In Docker, use host.docker.internal to reach host's localhost
            api_url = api_url.replace("localhost", "host.docker.internal")
        if api_url:
            env["TODOFORAI_API_URL"] = api_url
        if self.config.api_key:
            env["TODOFORAI_API_KEY"] = self.config.api_key
        if self.config.project_id:
            env["TODOFORAI_PROJECT_ID"] = self.config.project_id

        # Agent settings
        env["TODOFORAI_MODEL"] = self.config.default_model
        env["TODOFORAI_AGENT"] = self.config.default_agent
        env["TODOFORAI_TIMEOUT"] = str(self.config.timeout)

        return env

    def _run_agent_commands(self, task_description: str) -> List[TerminalCommand]:
        """Commands to execute the agent."""
        # Escape the task description for shell
        escaped_task = task_description.replace("'", "'\"'\"'")

        # Use the todoai-run script that handles edge + cli
        commands = [
            TerminalCommand(
                command=f"echo '{escaped_task}' | /usr/local/bin/todoai-run --agent '{self.config.default_agent}'",
                max_timeout_sec=self.config.timeout + 60,
                block=True,
            ),
        ]

        return commands


class TODOforAIInstalledAgentMinimal(AbstractInstalledAgent):
    """
    Minimal variant that only installs the CLI without Edge dependencies.

    Uses direct LLM calls instead of the full TODOforAI infrastructure.
    Lighter weight but less capable.
    """

    @staticmethod
    def name() -> str:
        return "todoforai-minimal"

    @property
    def _install_agent_script_path(self) -> Path:
        return Path(__file__).parent / "scripts" / "install_minimal.sh"

    @property
    def _env(self) -> Dict[str, str]:
        env = {}
        if os.environ.get("ANTHROPIC_API_KEY"):
            env["ANTHROPIC_API_KEY"] = os.environ["ANTHROPIC_API_KEY"]
        if os.environ.get("OPENAI_API_KEY"):
            env["OPENAI_API_KEY"] = os.environ["OPENAI_API_KEY"]
        return env

    def _run_agent_commands(self, task_description: str) -> List[TerminalCommand]:
        escaped_task = task_description.replace("'", "'\"'\"'")

        return [
            TerminalCommand(
                command=f"python /tmp/todoforai_minimal.py '{escaped_task}'",
                timeout=600,
            )
        ]


