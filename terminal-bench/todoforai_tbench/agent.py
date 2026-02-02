"""
TODOforAI Agent for Terminal-Bench.

This agent connects to the TODOforAI backend to execute Terminal-Bench tasks.
It sends tasks to the backend API and translates shell commands to the
Terminal-Bench tmux session.
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any

# Terminal-Bench imports (required)
from terminal_bench.agents import BaseAgent
from terminal_bench.agents.base_agent import AgentResult
from terminal_bench.terminal.tmux_session import TmuxSession

from .config import TBenchConfig, load_config

logger = logging.getLogger(__name__)


@dataclass
class ToolCall:
    """Represents a tool call from the backend."""
    tool_name: str
    arguments: Dict[str, Any]
    result: Optional[str] = None


class TODOforAIAgent(BaseAgent):
    """
    TODOforAI agent for Terminal-Bench.

    Connects to the TODOforAI backend API to execute tasks.
    Shell commands from the backend are sent to the Terminal-Bench tmux session.
    """

    def __init__(
        self,
        config: Optional[TBenchConfig] = None,
        model: Optional[str] = None,
        **kwargs,  # Accept extra kwargs from terminal-bench
    ):
        self.config = config or load_config()
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
        instruction: str,
        session: TmuxSession,
        logging_dir: Optional[Path] = None,
    ) -> AgentResult:
        """
        Execute a Terminal-Bench task via TODOforAI backend.

        Args:
            instruction: The task instructions
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
            asyncio.run(self._run_task(instruction, session))
            failure_mode = "none"

        except TimeoutError as e:
            logger.error(f"Task timed out: {e}")
            failure_mode = "agent_timeout"

        except Exception as e:
            logger.error(f"Task failed: {e}", exc_info=True)
            failure_mode = "unknown_agent_error"

        # Save logs
        if self.log_dir:
            self._save_logs()

        return AgentResult(
            input_tokens=self.total_input_tokens,
            output_tokens=self.total_output_tokens,
            failure_mode=failure_mode,
        )

    async def _run_task(self, task_description: str, session: TmuxSession) -> None:
        """
        Run task via TODOforAI's backend API.

        Creates a TODO and streams the execution, translating
        tool calls to tmux commands.
        """
        from todoforai_edge.edge import TODOforAIEdge
        from todoforai_edge.config import Config

        # Build config
        cfg = Config()
        if self.config.api_url:
            cfg.api_url = self.config.api_url
        if self.config.api_key:
            cfg.api_key = self.config.api_key

        if not cfg.api_key:
            raise ValueError(
                "API key required. Set TODOFORAI_API_KEY env var or configure in ~/.todoforai/tbench.json"
            )

        edge = TODOforAIEdge(cfg)

        logger.info(f"Connecting to TODOforAI backend at {cfg.api_url}...")

        try:
            # Get agent settings by name
            agents = await edge.list_agent_settings()
            agent_settings = None
            for agent in agents:
                if self.config.default_agent.lower() in agent.get("name", "").lower():
                    agent_settings = agent
                    break

            if not agent_settings:
                # Use first available agent if no match
                if agents:
                    agent_settings = agents[0]
                    logger.warning(f"Agent '{self.config.default_agent}' not found, using '{agent_settings.get('name')}'")
                else:
                    raise ValueError(f"No agents available and '{self.config.default_agent}' not found")

            logger.info(f"Using agent: {agent_settings.get('name')} (id: {agent_settings.get('id')})")

            # Create the TODO with terminal-bench context
            todo = await edge.add_message(
                project_id=self.config.project_id,
                content=f"[Terminal-Bench Task]\n\n{task_description}",
                agent_settings=agent_settings,
            )

            todo_id = todo.get("id") or todo.get("todo_id")
            logger.info(f"Created TODO: {todo_id}")

            # Watch execution and translate shell commands to tmux
            await self._watch_todo(edge, todo_id, session)

        finally:
            pass  # Edge client handles cleanup

    async def _watch_todo(
        self,
        edge,
        todo_id: str,
        session: TmuxSession,
    ) -> None:
        """Watch TODO execution and send shell commands to tmux."""

        def callback(msg_type: str, payload: Dict[str, Any]):
            self._handle_message(msg_type, payload, session)

        result = await edge.wait_for_todo_completion(
            todo_id,
            timeout=self.config.timeout,
            callback=callback,
        )

        if not result.get("success"):
            error = result.get("payload", {}).get("error", "Unknown error")
            logger.warning(f"TODO execution issue: {error}")

    def _handle_message(
        self,
        msg_type: str,
        payload: Dict[str, Any],
        session: TmuxSession,
    ) -> None:
        """Handle a message from the backend stream."""

        if msg_type == "block:start_shell":
            # Shell command - send to tmux
            command = payload.get("command", "")
            if command:
                logger.info(f"Executing: {command[:80]}...")
                session.send_keys(command)

                # Record tool call
                self.tool_calls.append(ToolCall(
                    tool_name="shell",
                    arguments={"command": command},
                ))

                # Wait for completion
                self._wait_for_command(session)

        elif msg_type == "block:message":
            # Token from LLM response - estimate tokens
            content = payload.get("content", "")
            if content:
                self.total_output_tokens += len(content) // 4

        elif msg_type == "todo:msg_done":
            # Execution complete - get actual token counts
            meta = payload.get("meta", {})
            if "input_tokens" in meta:
                self.total_input_tokens = meta["input_tokens"]
            if "output_tokens" in meta:
                self.total_output_tokens = meta["output_tokens"]

    def _wait_for_command(self, session: TmuxSession, timeout: int = 60) -> None:
        """Wait for a command to complete in tmux."""
        time.sleep(0.5)
        waited = 0
        while session.is_busy() and waited < timeout:
            time.sleep(0.5)
            waited += 0.5

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
                "model": self.model,
            }, f, indent=2)
