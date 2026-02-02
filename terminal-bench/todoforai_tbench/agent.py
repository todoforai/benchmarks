"""
TODOforAI Agent for Terminal-Bench.

This agent connects to the TODOforAI backend with full edge integration.
The edge runs in the task environment and the backend executes commands
directly via the edge's BASH tool.
"""

import asyncio
import json
import logging
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


class TmuxShellRedirector:
    """
    Redirects shell execution from the edge to the tmux session.

    When the backend calls BASH via the edge, this redirector ensures
    the command runs in the terminal-bench tmux session.
    """

    _instance = None
    _original_execute_block = None

    def __init__(self, session: TmuxSession, tool_calls: List[ToolCall]):
        self.session = session
        self.tool_calls = tool_calls
        TmuxShellRedirector._instance = self

    @classmethod
    def install(cls, session: TmuxSession, tool_calls: List[ToolCall]):
        """Install the tmux redirector by monkey-patching ShellProcess."""
        instance = cls(session, tool_calls)

        from todoforai_edge.handlers.shell_handler import ShellProcess

        if cls._original_execute_block is None:
            cls._original_execute_block = ShellProcess.execute_block

        async def redirected_execute_block(self, block_id, content, client, todo_id, request_id, timeout, root_path=""):
            return await instance._execute_in_tmux(block_id, content, client, todo_id, request_id, timeout)

        ShellProcess.execute_block = redirected_execute_block
        logger.info("TmuxShellRedirector installed - edge BASH routed to tmux")
        return instance

    @classmethod
    def uninstall(cls):
        """Restore original ShellProcess behavior."""
        if cls._original_execute_block is not None:
            from todoforai_edge.handlers.shell_handler import ShellProcess
            ShellProcess.execute_block = cls._original_execute_block
            cls._original_execute_block = None
            logger.info("TmuxShellRedirector uninstalled")

    async def _execute_in_tmux(self, block_id, content, client, todo_id, request_id, timeout):
        """Execute shell command in tmux session."""
        from todoforai_edge.constants.messages import (
            shell_block_start_result_msg,
            shell_block_message_result_msg,
            shell_block_done_result_msg,
        )

        print(f"[Edge→Tmux] {content[:100]}...")

        self.tool_calls.append(ToolCall(
            tool_name="BASH",
            arguments={"command": content},
        ))

        await client.send_response(shell_block_start_result_msg(todo_id, block_id, "execute", request_id))

        try:
            self.session.send_keys(content, block=True, max_timeout_sec=float(timeout))
            output = self.session.capture_pane()

            if output:
                await client.send_response(shell_block_message_result_msg(todo_id, block_id, output[-2000:], request_id))

            await client.send_response(shell_block_done_result_msg(todo_id, block_id, 0, output or "", request_id))

        except Exception as e:
            logger.error(f"[Edge→Tmux] Error: {e}")
            await client.send_response(shell_block_done_result_msg(todo_id, block_id, 1, str(e), request_id))


class TODOforAIAgent(BaseAgent):
    """
    TODOforAI agent for Terminal-Bench.

    Architecture:
    1. Start edge in task environment
    2. Send task to backend via TODO
    3. Backend executes commands via edge's BASH tool
    4. TmuxShellRedirector routes BASH calls to tmux session
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
        """Execute a Terminal-Bench task via TODOforAI backend."""
        self.log_dir = logging_dir
        self.tool_calls = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0

        try:
            print(f"[TODOforAI] Task: {instruction[:100]}...")
            asyncio.run(self._run_task_with_edge(instruction, session))
            print(f"[TODOforAI] Done. Tool calls: {len(self.tool_calls)}")
            failure_mode = "none"

        except TimeoutError as e:
            print(f"[TODOforAI] Timeout: {e}")
            failure_mode = "agent_timeout"

        except Exception as e:
            print(f"[TODOforAI] Error: {e}")
            import traceback
            traceback.print_exc()
            failure_mode = "unknown_agent_error"

        finally:
            TmuxShellRedirector.uninstall()

        if self.log_dir:
            self._save_logs()

        return AgentResult(
            input_tokens=self.total_input_tokens,
            output_tokens=self.total_output_tokens,
            failure_mode=failure_mode,
        )

    async def _run_task_with_edge(self, task_description: str, session: TmuxSession) -> None:
        """Run task with edge integration."""
        from todoforai_edge.edge import TODOforAIEdge
        from todoforai_edge.config import Config

        # Create edge config directly (don't use argparse - it conflicts with terminal-bench args)
        config = Config()
        config.api_url = self.config.api_url
        config.api_key = self.config.api_key

        if not config.api_key:
            raise ValueError("API key required - set in ~/.todoforai/tbench.json")

        # Install tmux redirector - routes edge BASH calls to tmux session
        TmuxShellRedirector.install(session, self.tool_calls)

        # Create and start edge
        edge = TODOforAIEdge(config)
        print(f"[TODOforAI] Connecting edge to {config.api_url}...")

        edge_task = asyncio.create_task(self._run_edge(edge))

        try:
            # Wait for edge to connect
            for _ in range(10):
                await asyncio.sleep(1)
                if edge.connected and edge.edge_id:
                    print(f"[TODOforAI] Edge ready: {edge.edge_id}")
                    break
            else:
                raise ConnectionError("Edge failed to connect")

            # Find agent
            agents = await edge.list_agent_settings()
            agent_settings = next(
                (a for a in agents if self.config.default_agent.lower() in a.get("name", "").lower()),
                agents[0] if agents else None
            )
            if not agent_settings:
                raise ValueError("No agents available")

            print(f"[TODOforAI] Using agent: {agent_settings.get('name')}")

            # Create TODO - backend will execute via edge
            todo = await edge.add_message(
                project_id=self.config.project_id,
                content=f"[Terminal-Bench Task]\n\n{task_description}",
                agent_settings=agent_settings,
            )

            todo_id = todo.get("id") or todo.get("todo_id")
            print(f"[TODOforAI] TODO: {todo_id}")

            # Wait for completion
            result = await edge.wait_for_todo_completion(
                todo_id,
                timeout=self.config.timeout,
                callback=self._on_message,
            )

            if not result.get("success"):
                print(f"[TODOforAI] Issue: {result.get('payload', {}).get('error', 'Unknown')}")

        finally:
            edge_task.cancel()
            try:
                await edge_task
            except asyncio.CancelledError:
                pass

    async def _run_edge(self, edge) -> None:
        """Run edge client."""
        try:
            await edge.start()
        except asyncio.CancelledError:
            print("[TODOforAI] Edge stopped")

    def _on_message(self, msg_type: str, payload: Dict[str, Any]) -> None:
        """Handle backend messages - tool calls come via TmuxShellRedirector."""
        if msg_type == "todo:msg_done":
            meta = payload.get("meta", {})
            self.total_input_tokens = meta.get("input_tokens", 0)
            self.total_output_tokens = meta.get("output_tokens", 0)

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
