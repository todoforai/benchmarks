"""
TODOforAI BaseAgent implementation for Terminal-Bench.

This is the primary integration that wraps TODOforAI's capabilities
for Terminal-Bench evaluation.
"""

import asyncio
import json
import logging
import os
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any

# Terminal-Bench imports
try:
    from terminal_bench.agents import BaseAgent, AgentResult
    from terminal_bench.terminal.tmux_session import TmuxSession
except ImportError:
    # Allow importing without terminal-bench installed (for development)
    BaseAgent = object
    AgentResult = None
    TmuxSession = None

from .config import TBenchConfig, load_config

logger = logging.getLogger(__name__)


@dataclass
class ToolCall:
    """Represents a tool call from the LLM."""
    tool_name: str
    arguments: Dict[str, Any]
    result: Optional[str] = None


class TODOforAIAgent(BaseAgent):
    """
    TODOforAI agent for Terminal-Bench.

    This agent bridges Terminal-Bench's TmuxSession to TODOforAI's
    tool execution system. It can operate in multiple modes:

    1. CLI mode: Pipes tasks through todoai-cli
    2. Direct mode: Calls the Julia agent directly
    3. API mode: Uses TODOforAI's backend API
    """

    def __init__(
        self,
        config: Optional[TBenchConfig] = None,
        mode: str = "cli",  # "cli", "direct", "api"
        model: Optional[str] = None,
    ):
        self.config = config or load_config()
        self.mode = mode
        self.model = model or self.config.default_model

        # Token tracking
        self.total_input_tokens = 0
        self.total_output_tokens = 0

        # Logging
        self.log_dir: Optional[Path] = None
        self.tool_calls: List[ToolCall] = []

    @staticmethod
    def name() -> str:
        return "todoforai"

    def perform_task(
        self,
        task_description: str,
        session: TmuxSession,
        logging_dir: Optional[Path] = None,
    ) -> AgentResult:
        """
        Execute a Terminal-Bench task.

        Args:
            task_description: The task instructions
            session: TmuxSession for sending commands
            logging_dir: Directory for logs

        Returns:
            AgentResult with token counts
        """
        self.log_dir = logging_dir
        self.tool_calls = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0

        try:
            if self.mode == "cli":
                self._run_via_cli(task_description, session)
            elif self.mode == "direct":
                self._run_direct(task_description, session)
            elif self.mode == "api":
                asyncio.run(self._run_via_api(task_description, session))
            else:
                raise ValueError(f"Unknown mode: {self.mode}")

            failure_mode = None

        except TimeoutError as e:
            logger.error(f"Task timed out: {e}")
            failure_mode = "timeout"

        except Exception as e:
            logger.error(f"Task failed: {e}")
            failure_mode = f"error: {str(e)}"

        # Save logs
        if self.log_dir:
            self._save_logs()

        return AgentResult(
            input_tokens=self.total_input_tokens,
            output_tokens=self.total_output_tokens,
            failure_mode=failure_mode,
        )

    def _run_via_cli(self, task_description: str, session: TmuxSession) -> None:
        """
        Run task by piping through todoai-cli with terminal-bench mode.

        This mode sets up environment variables so todoai-cli knows
        to send commands to the tbench tmux session instead of its
        normal Edge shell.
        """
        env = os.environ.copy()
        env["TBENCH_MODE"] = "1"
        env["TBENCH_SESSION_ID"] = session.session_id if hasattr(session, 'session_id') else "tbench"

        cmd = [
            "todoai-cli",
            "--agent", self.config.default_agent,
            "--terminal-bench",  # Special flag for tbench mode
            "--timeout", str(self.config.timeout),
            "--json",
            "-y",  # Skip confirmation
        ]

        if self.config.project_id:
            cmd.extend(["--project", self.config.project_id])

        logger.info(f"Running: {' '.join(cmd[:5])}...")

        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=env,
        )

        stdout, stderr = proc.communicate(
            input=task_description,
            timeout=self.config.timeout + 30,
        )

        if proc.returncode != 0:
            logger.warning(f"CLI exited with code {proc.returncode}: {stderr}")

        # Parse output for token counts
        self._parse_cli_output(stdout)

    def _run_direct(self, task_description: str, session: TmuxSession) -> None:
        """
        Run task by calling Julia agent directly.

        This bypasses the Edge/Backend architecture and directly
        invokes the Julia TODO4AI agent with a custom tool that
        sends commands to the TmuxSession.
        """
        # Build Julia command
        agent_dir = Path(__file__).parent.parent.parent.parent / "agent"

        julia_code = f'''
        using TODO4AI

        # Custom shell tool that sends to tbench tmux session
        tbench_session_id = "{session.session_id if hasattr(session, 'session_id') else 'tbench'}"

        result = TODO4AI.run_terminal_bench_task(
            task = raw"{task_description}",
            session_id = tbench_session_id,
            model = "{self.model}",
            timeout = {self.config.timeout},
            max_iterations = {self.config.max_iterations}
        )

        # Output token counts as JSON
        using JSON3
        println("__TBENCH_RESULT__")
        println(JSON3.write(result))
        '''

        cmd = [
            "julia",
            f"--project={agent_dir}",
            "-e", julia_code,
        ]

        logger.info("Running Julia agent directly...")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=self.config.timeout + 60,
            cwd=agent_dir,
        )

        if result.returncode != 0:
            logger.warning(f"Julia agent failed: {result.stderr}")

        # Parse result
        self._parse_julia_output(result.stdout)

    async def _run_via_api(self, task_description: str, session: TmuxSession) -> None:
        """
        Run task via TODOforAI's backend API.

        Creates a TODO and streams the execution, translating
        tool calls to tmux commands.
        """
        # Import the Edge client
        from todoforai_edge.edge import TODOforAIEdge

        edge = TODOforAIEdge(
            api_url=self.config.api_url,
            api_key=self.config.api_key,
        )

        await edge.connect()

        try:
            # Create the TODO with terminal-bench context
            todo = await edge.add_message(
                project_id=self.config.project_id,
                content=f"[Terminal-Bench Task]\n\n{task_description}",
                agent_settings={"name": self.config.default_agent},
            )

            todo_id = todo.get("todo_id")

            # Stream execution and translate to tmux
            async for msg_type, payload in edge.stream_todo(todo_id):
                await self._handle_api_message(msg_type, payload, session)

        finally:
            await edge.disconnect()

    async def _handle_api_message(
        self,
        msg_type: str,
        payload: Dict[str, Any],
        session: TmuxSession,
    ) -> None:
        """Handle a message from the API stream."""
        if msg_type == "block:start_shell":
            # Shell command - send to tmux
            command = payload.get("command", "")
            if command:
                logger.info(f"Executing: {command[:50]}...")
                session.send_keys(command)

                # Wait for completion
                time.sleep(0.5)
                while session.is_busy():
                    time.sleep(0.1)

        elif msg_type == "block:message":
            # Token from LLM response
            content = payload.get("content", "")
            if content:
                # Estimate tokens (rough)
                self.total_output_tokens += len(content) // 4

        elif msg_type == "todo:msg_done":
            # Execution complete
            meta = payload.get("meta", {})
            if "input_tokens" in meta:
                self.total_input_tokens = meta["input_tokens"]
            if "output_tokens" in meta:
                self.total_output_tokens = meta["output_tokens"]

    def _parse_cli_output(self, output: str) -> None:
        """Parse CLI output for token counts and logs."""
        try:
            # Look for JSON output with token counts
            if "__TOKENS__" in output:
                _, json_part = output.split("__TOKENS__", 1)
                data = json.loads(json_part.strip())
                self.total_input_tokens = data.get("input_tokens", 0)
                self.total_output_tokens = data.get("output_tokens", 0)
        except Exception as e:
            logger.debug(f"Could not parse CLI output: {e}")

    def _parse_julia_output(self, output: str) -> None:
        """Parse Julia output for token counts."""
        try:
            if "__TBENCH_RESULT__" in output:
                _, json_part = output.split("__TBENCH_RESULT__", 1)
                data = json.loads(json_part.strip())
                self.total_input_tokens = data.get("input_tokens", 0)
                self.total_output_tokens = data.get("output_tokens", 0)
                self.tool_calls = [
                    ToolCall(**tc) for tc in data.get("tool_calls", [])
                ]
        except Exception as e:
            logger.debug(f"Could not parse Julia output: {e}")

    def _save_logs(self) -> None:
        """Save execution logs to log_dir."""
        if not self.log_dir:
            return

        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Save tool calls
        tool_calls_path = self.log_dir / "tool_calls.json"
        with open(tool_calls_path, 'w') as f:
            json.dump(
                [{"tool": tc.tool_name, "args": tc.arguments, "result": tc.result}
                 for tc in self.tool_calls],
                f,
                indent=2,
            )

        # Save summary
        summary_path = self.log_dir / "summary.json"
        with open(summary_path, 'w') as f:
            json.dump({
                "input_tokens": self.total_input_tokens,
                "output_tokens": self.total_output_tokens,
                "tool_calls_count": len(self.tool_calls),
                "mode": self.mode,
                "model": self.model,
            }, f, indent=2)
