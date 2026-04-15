"""
TODOforAI agent adapter for Harbor (Terminal-Bench 2.0).
"""

import shlex
from pathlib import Path

from harbor.agents.installed.base import BaseInstalledAgent, ExecInput
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class TODOforAIHarborAgent(BaseInstalledAgent):
    @staticmethod
    def name() -> str:
        return "todoforai"

    @property
    def _install_agent_template_path(self) -> Path:
        return Path(__file__).parent / "install-todoforai.sh.j2"

    def create_run_agent_commands(self, instruction: str) -> list[ExecInput]:
        return [
            ExecInput(
                command=(
                    'export PATH="$HOME/.bun/bin:$PATH" && '
                    "todoforai-edge --path /app & sleep 2 && "
                    f"echo {shlex.quote(instruction)} | todoai --non-interactive --dangerously-skip-permissions --path /app"
                ),
                timeout_sec=660,
            ),
        ]

    def populate_context_post_run(self, context: AgentContext) -> None:
        pass

    async def setup(self, environment: BaseEnvironment) -> None:
        dist_dir = Path(__file__).parent / "dist"
        if dist_dir.is_dir():
            await environment.exec(command="mkdir -p /installed-agent/dist")
            await environment.upload_dir(source_dir=dist_dir, target_dir="/installed-agent/dist")
        await super().setup(environment)
