"""
TODOforAI agent adapter for Harbor (Terminal-Bench 2.0).
"""

import os
import shlex
from pathlib import Path

from harbor.agents.installed.base import BaseInstalledAgent, with_prompt_template
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext


class TODOforAIHarborAgent(BaseInstalledAgent):
    @staticmethod
    def name() -> str:
        return "todoforai"

    @property
    def _install_agent_template_path(self) -> Path:
        return Path(__file__).parent / "install-todoforai.sh.j2"

    def populate_context_post_run(self, context: AgentContext) -> None:
        pass

    async def setup(self, environment: BaseEnvironment) -> None:
        dist_dir = Path(__file__).parent / "dist"
        if dist_dir.is_dir():
            await environment.exec(command="mkdir -p /installed-agent/dist")
            await environment.upload_dir(source_dir=dist_dir, target_dir="/installed-agent/dist")
        await super().setup(environment)

    @with_prompt_template
    async def run(
        self, instruction: str, environment: BaseEnvironment, context: AgentContext
    ) -> None:
        api_key = os.environ.get("TODOFORAI_API_KEY", "")
        api_url = os.environ.get("TODOFORAI_API_URL", "")
        edge_flags = f" --api-key {shlex.quote(api_key)}" if api_key else ""
        if api_url:
            edge_flags += f" --api-url {shlex.quote(api_url)}"
        todoai_flags = f" --api-url {shlex.quote(api_url)}" if api_url else ""

        await self.exec_as_agent(
            environment,
            command=(
                'export PATH="$HOME/.bun/bin:$PATH" && '
                f"todoforai-edge --path /app{edge_flags} & sleep 2 && "
                f"echo {shlex.quote(instruction)} | todoai --non-interactive --dangerously-skip-permissions --path /app{todoai_flags}"
            ),
        )
