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

    async def install(self, environment: BaseEnvironment) -> None:
        install_script = Path(__file__).parent / "install-todoforai.sh.j2"
        await environment.upload_file(source_path=install_script, target_path="/installed-agent/install-todoforai.sh")
        await self.exec_as_root(
            environment,
            command="bash /installed-agent/install-todoforai.sh",
            env={"DEBIAN_FRONTEND": "noninteractive"},
        )

    # Stable machine-id so the edge registers as the same device every run
    MACHINE_ID = "todoforai-terminal-bench-00000000000000000000"

    async def setup(self, environment: BaseEnvironment) -> None:
        await environment.exec(
            command=f"echo {self.MACHINE_ID} > /etc/machine-id", user="root",
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
        api_key = os.environ.get("TODOFORAI_API_KEY", "")
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
