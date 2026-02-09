"""
TODOforAI Agent for Terminal-Bench.

Installs the edge inside the Docker container and runs it there.
The edge connects back to the host backend, and all tool execution
happens naturally inside the container's filesystem.
"""

import base64
import json
from pathlib import Path
from typing import Optional

from terminal_bench.agents import BaseAgent
from terminal_bench.agents.base_agent import AgentResult
from terminal_bench.terminal.tmux_session import TmuxSession

from .config import TBenchConfig, load_config

# Path to the locally-built edge wheel (has create_file/read_file unlike pip version)
EDGE_WHEEL_PATH = Path(__file__).parent.parent / "edge_wheel" / "todoforai_edge_cli-0.12.2-py3-none-any.whl"

# This script runs INSIDE the Docker container.
# It starts the edge, creates a TODO, and waits for completion.
DOCKER_RUNNER_SCRIPT = r'''
import asyncio, sys, os, json

async def main():
    from todoforai_edge.edge import TODOforAIEdge
    from todoforai_edge.config import Config

    config = Config()
    config.api_url = os.environ.get("TODOFORAI_API_URL", "http://host.docker.internal:4000")
    config.api_key = os.environ["TODOFORAI_API_KEY"]
    edge = TODOforAIEdge(config)
    edge_task = asyncio.create_task(edge.start())

    # Wait for edge to connect
    for i in range(30):
        await asyncio.sleep(1)
        if edge.connected and edge.edge_id:
            break
    else:
        print("TBENCH_ERROR: Edge failed to connect after 30s", flush=True)
        sys.exit(1)

    print(f"TBENCH_EDGE_ID: {edge.edge_id}", flush=True)

    # Allow workspace access to /app (needed for workspace handler path checks)
    try:
        if hasattr(edge, 'edge_config') and hasattr(edge.edge_config, 'config'):
            edge.edge_config.config["workspacepaths"] = ["/app"]
    except Exception:
        pass

    # Find agent settings
    agents = await edge.list_agent_settings()
    agent_name = os.environ.get("TODOFORAI_AGENT", "Agent")
    agent = next(
        (a for a in agents if agent_name.lower() in a.get("name", "").lower()),
        agents[0] if agents else None,
    )
    if not agent:
        print("TBENCH_ERROR: No agents available", flush=True)
        sys.exit(1)

    # Override edgesMcpConfigs: use THIS Docker edge with /app workspace
    # workspacePaths needed so Julia agent routes tools to this edge
    agent = dict(agent)
    agent["edgesMcpConfigs"] = {
        edge.edge_id: {
            "todoai_edge": {"workspacePaths": ["/app"]}
        }
    }
    print(f"TBENCH_AGENT: {agent.get('name')}", flush=True)

    # Create TODO
    task_desc = sys.argv[1]
    todo = await edge.add_message(
        project_id=os.environ.get("TODOFORAI_PROJECT_ID"),
        content=task_desc,
        agent_settings=agent,
    )

    todo_id = todo.get("id") or todo.get("todo_id")
    print(f"TBENCH_TODO_ID: {todo_id}", flush=True)

    # Track tokens
    tokens = {"input": 0, "output": 0}

    def on_message(msg_type, payload):
        if msg_type == "todo:msg_done":
            meta = payload.get("meta", {})
            tokens["input"] += meta.get("input_tokens", 0)
            tokens["output"] += meta.get("output_tokens", 0)

    timeout = int(os.environ.get("TODOFORAI_TIMEOUT", "600"))
    result = await edge.wait_for_todo_completion(
        todo_id, timeout=timeout, callback=on_message,
    )

    success = result.get("success", False)

    # Write result to file (capture_pane might miss scrolled output)
    result_data = {
        "success": success,
        "input_tokens": tokens["input"],
        "output_tokens": tokens["output"],
    }
    with open("/tmp/tbench_result.json", "w") as f:
        json.dump(result_data, f)

    print(f"TBENCH_RESULT: {json.dumps(result_data)}", flush=True)

    edge_task.cancel()
    try:
        await edge_task
    except asyncio.CancelledError:
        pass

asyncio.run(main())
'''


class TODOforAIAgent(BaseAgent):
    """
    TODOforAI agent for Terminal-Bench.

    Architecture:
    1. Install edge inside Docker container via tmux (from local wheel)
    2. Run Python script that starts edge + creates TODO
    3. Edge connects to host backend, Julia agent processes TODO
    4. Tool calls execute inside Docker naturally
    """

    def __init__(
        self,
        config: Optional[TBenchConfig] = None,
        model: Optional[str] = None,
        **kwargs,
    ):
        self.config = config or load_config()
        self.model = model or self.config.default_model
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.log_dir: Optional[Path] = None

        # Pre-encode the wheel for copying into Docker
        if EDGE_WHEEL_PATH.exists():
            self._wheel_b64 = base64.b64encode(EDGE_WHEEL_PATH.read_bytes()).decode()
            self._wheel_name = EDGE_WHEEL_PATH.name
        else:
            self._wheel_b64 = None
            self._wheel_name = None

    @staticmethod
    def name() -> str:
        return "todoforai"

    def perform_task(
        self,
        instruction: str,
        session: TmuxSession,
        logging_dir: Optional[Path] = None,
    ) -> AgentResult:
        """Execute a Terminal-Bench task via TODOforAI backend."""
        self.log_dir = logging_dir
        self.total_input_tokens = 0
        self.total_output_tokens = 0

        try:
            print(f"[TODOforAI] Task: {instruction[:100]}...")

            self._install_edge(session)
            self._run_task(session, instruction)

            failure_mode = "none"
            print(f"[TODOforAI] Done. Tokens: {self.total_input_tokens}in/{self.total_output_tokens}out")

        except TimeoutError as e:
            print(f"[TODOforAI] Timeout: {e}")
            failure_mode = "agent_timeout"

        except Exception as e:
            print(f"[TODOforAI] Error: {e}")
            import traceback
            traceback.print_exc()
            failure_mode = "unknown_agent_error"

        if self.log_dir:
            self._save_logs()

        return AgentResult(
            input_tokens=self.total_input_tokens,
            output_tokens=self.total_output_tokens,
            failure_mode=failure_mode,
        )

    def _check_edge_installed(self, session: TmuxSession) -> bool:
        """Check if the edge is already installed inside the container."""
        # Use unique markers to avoid false matches from the command line itself in capture_pane
        session.send_keys(
            ["test -x /opt/todoforai-venv/bin/python && /opt/todoforai-venv/bin/python -c 'import todoforai_edge' 2>/dev/null && echo __INSTALLED_OK__ || echo __NOT_INSTALLED__", "Enter"],
            block=True, max_timeout_sec=10,
        )
        output = session.capture_pane() or ""
        # Count occurrences: the command line has it once, actual output adds a second
        return output.count("__INSTALLED_OK__") >= 2

    def _install_edge(self, session: TmuxSession) -> None:
        """Install todoforai-edge inside the Docker container."""
        already_installed = self._check_edge_installed(session)

        if not already_installed:
            print("[TODOforAI] Installing edge inside Docker...")

            cmds = [
                # Install Python and venv support (always ensure python3-venv is present)
                "apt-get update -qq && apt-get install -y -qq python3 python3-pip python3-venv",
                # Create venv and install pip
                "python3 -m venv /opt/todoforai-venv",
                "/opt/todoforai-venv/bin/pip install -q --upgrade pip",
            ]

            for cmd in cmds:
                print(f"[TODOforAI]   > {cmd[:80]}...")
                session.send_keys([cmd, "Enter"], block=True, max_timeout_sec=180)

        # Always install local wheel (has create_file/read_file unlike pip version)
        if self._wheel_b64:
            print(f"[TODOforAI] Installing local edge wheel ({self._wheel_name})...")
            # Send in chunks to avoid tmux buffer issues
            chunk_size = 4000
            chunks = [self._wheel_b64[i:i+chunk_size] for i in range(0, len(self._wheel_b64), chunk_size)]
            session.send_keys(["> /tmp/edge.whl.b64", "Enter"], block=True, max_timeout_sec=5)
            for chunk in chunks:
                session.send_keys([f"echo '{chunk}' >> /tmp/edge.whl.b64", "Enter"], block=True, max_timeout_sec=5)
            session.send_keys([f"base64 -d /tmp/edge.whl.b64 > /tmp/{self._wheel_name}", "Enter"], block=True, max_timeout_sec=5)
            session.send_keys([f"/opt/todoforai-venv/bin/pip install -q --force-reinstall /tmp/{self._wheel_name}", "Enter"], block=True, max_timeout_sec=60)
        elif not already_installed:
            print("[TODOforAI] No local wheel found, falling back to pip...")
            session.send_keys(["/opt/todoforai-venv/bin/pip install -q todoforai-edge-cli", "Enter"], block=True, max_timeout_sec=180)

        print("[TODOforAI] Edge installed")

    def _run_task(self, session: TmuxSession, instruction: str) -> None:
        """Write runner script into Docker and execute it."""
        # Write the runner script (base64-encoded to avoid heredoc issues with tmux)
        encoded = base64.b64encode(DOCKER_RUNNER_SCRIPT.encode()).decode()
        session.send_keys(
            [f"echo '{encoded}' | base64 -d > /tmp/tbench_runner.py", "Enter"],
            block=True,
            max_timeout_sec=10,
        )

        # Set environment variables
        # Detect host IP from inside Docker (host.docker.internal doesn't work on Linux,
        # and `ip` command may not be installed — use Python to parse /proc/net/route)
        session.send_keys(
            ["""export DOCKER_HOST_IP=$(python3 -c "import struct; f=open('/proc/net/route'); [print('.'.join(str(b) for b in struct.pack('<I',int(l.split()[2],16)))) for l in f if l.split()[1]=='00000000']; f.close()" 2>/dev/null | head -1)""", "Enter"],
            block=True,
            max_timeout_sec=5,
        )

        api_url = self.config.api_url
        if "localhost" in api_url:
            api_url = api_url.replace("localhost", "$DOCKER_HOST_IP")

        env_vars = {
            "TODOFORAI_API_URL": api_url,
            "TODOFORAI_API_KEY": self.config.next_api_key(),
            "TODOFORAI_AGENT": self.config.default_agent,
            "TODOFORAI_TIMEOUT": str(self.config.timeout),
        }
        if self.config.project_id:
            env_vars["TODOFORAI_PROJECT_ID"] = self.config.project_id

        for key, val in env_vars.items():
            # Use double quotes for API_URL so $DOCKER_HOST_IP gets expanded
            if "$" in val:
                session.send_keys([f'export {key}="{val}"', "Enter"], block=True, max_timeout_sec=5)
            else:
                session.send_keys([f"export {key}='{val}'", "Enter"], block=True, max_timeout_sec=5)

        # Run the script
        escaped = instruction.replace("'", "'\\''")
        session.send_keys(
            [f"/opt/todoforai-venv/bin/python /tmp/tbench_runner.py '{escaped}'", "Enter"],
            block=True,
            max_timeout_sec=self.config.timeout + 60,
        )

        # Read results from file (more reliable than capture_pane)
        session.send_keys(["cat /tmp/tbench_result.json", "Enter"], block=True, max_timeout_sec=10)
        output = session.capture_pane()
        self._parse_output(output or "")

    def _parse_output(self, output: str) -> None:
        """Parse runner output for token counts."""
        for line in output.split("\n"):
            line = line.strip()
            if line.startswith("{") and "input_tokens" in line:
                try:
                    result = json.loads(line)
                    self.total_input_tokens = result.get("input_tokens", 0)
                    self.total_output_tokens = result.get("output_tokens", 0)
                    return
                except json.JSONDecodeError:
                    continue
            if "TBENCH_RESULT:" in line:
                try:
                    json_str = line.split("TBENCH_RESULT:", 1)[1].strip()
                    result = json.loads(json_str)
                    self.total_input_tokens = result.get("input_tokens", 0)
                    self.total_output_tokens = result.get("output_tokens", 0)
                    return
                except (json.JSONDecodeError, IndexError):
                    continue

    def _save_logs(self) -> None:
        """Save execution logs."""
        if not self.log_dir:
            return

        self.log_dir.mkdir(parents=True, exist_ok=True)

        summary_path = self.log_dir / "summary.json"
        with open(summary_path, 'w') as f:
            json.dump({
                "input_tokens": self.total_input_tokens,
                "output_tokens": self.total_output_tokens,
                "model": self.model,
            }, f, indent=2)
