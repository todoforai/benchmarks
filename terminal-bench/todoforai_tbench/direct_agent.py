"""
TODOforAI Direct Agent for Terminal-Bench.

This agent bypasses the Edge/Backend architecture and directly
uses an LLM to generate and execute terminal commands.

Useful for:
- Quick testing without full TODOforAI infrastructure
- Benchmarking raw LLM capabilities
- Debugging
"""

import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Dict, Any

# Terminal-Bench imports
try:
    from terminal_bench.agents import BaseAgent, AgentResult
    from terminal_bench.terminal.tmux_session import TmuxSession
except ImportError:
    BaseAgent = object
    AgentResult = None
    TmuxSession = None

# LLM client imports
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

from .config import TBenchConfig, load_config

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert terminal user solving a task. You have access to a bash terminal.

For each step:
1. Think about what you need to do
2. Execute a single command
3. Observe the output
4. Decide next steps

Output your commands in this format:
```bash
your_command_here
```

When you have completed the task, output:
```
TASK_COMPLETE: <brief summary of what you did>
```

If you cannot complete the task, output:
```
TASK_FAILED: <reason>
```

Important:
- Execute one command at a time
- Wait for output before proceeding
- Use absolute paths when possible
- Handle errors gracefully
"""


@dataclass
class ConversationMessage:
    role: str  # "user", "assistant"
    content: str


@dataclass
class DirectAgentState:
    """Tracks agent state during execution."""
    messages: List[ConversationMessage] = field(default_factory=list)
    commands_executed: List[str] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    iterations: int = 0


class TODOforAIDirectAgent(BaseAgent):
    """
    Direct LLM agent for Terminal-Bench.

    Uses Anthropic or OpenAI APIs directly without TODOforAI infrastructure.
    """

    def __init__(
        self,
        config: Optional[TBenchConfig] = None,
        model: Optional[str] = None,
        provider: str = "anthropic",  # "anthropic" or "openai"
    ):
        self.config = config or load_config()
        self.model = model or self.config.default_model
        self.provider = provider

        # Initialize client
        if provider == "anthropic":
            if not HAS_ANTHROPIC:
                raise ImportError("anthropic package required: pip install anthropic")
            self.client = anthropic.Anthropic()
        elif provider == "openai":
            if not HAS_OPENAI:
                raise ImportError("openai package required: pip install openai")
            self.client = openai.OpenAI()
        else:
            raise ValueError(f"Unknown provider: {provider}")

        self.state: Optional[DirectAgentState] = None

    @staticmethod
    def name() -> str:
        return "todoforai-direct"

    def perform_task(
        self,
        task_description: str,
        session: TmuxSession,
        logging_dir: Optional[Path] = None,
    ) -> AgentResult:
        """Execute the task using direct LLM calls."""
        self.state = DirectAgentState()
        failure_mode = None

        try:
            # Initial message with task
            self.state.messages.append(ConversationMessage(
                role="user",
                content=f"Task: {task_description}\n\nThe terminal is ready. Begin solving the task."
            ))

            # Agent loop
            while self.state.iterations < self.config.max_iterations:
                self.state.iterations += 1

                # Get LLM response
                response = self._call_llm()

                # Check for completion
                if "TASK_COMPLETE:" in response:
                    logger.info("Task completed successfully")
                    break
                elif "TASK_FAILED:" in response:
                    failure_mode = "agent_declared_failure"
                    break

                # Extract and execute command
                command = self._extract_command(response)

                if command:
                    output = self._execute_command(command, session)

                    # Add observation to conversation
                    self.state.messages.append(ConversationMessage(
                        role="user",
                        content=f"Command output:\n```\n{output}\n```"
                    ))
                else:
                    # No command found, prompt for one
                    self.state.messages.append(ConversationMessage(
                        role="user",
                        content="Please provide a bash command to execute, or indicate if the task is complete."
                    ))

            else:
                # Max iterations reached
                failure_mode = "max_iterations"

        except Exception as e:
            logger.error(f"Agent error: {e}")
            failure_mode = f"error: {str(e)}"

        # Save logs
        if logging_dir:
            self._save_logs(logging_dir)

        return AgentResult(
            input_tokens=self.state.input_tokens,
            output_tokens=self.state.output_tokens,
            failure_mode=failure_mode,
        )

    def _call_llm(self) -> str:
        """Call the LLM and get a response."""
        if self.provider == "anthropic":
            return self._call_anthropic()
        else:
            return self._call_openai()

    def _call_anthropic(self) -> str:
        """Call Anthropic API."""
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in self.state.messages
        ]

        response = self.client.messages.create(
            model=self._get_anthropic_model(),
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

        # Track tokens
        self.state.input_tokens += response.usage.input_tokens
        self.state.output_tokens += response.usage.output_tokens

        # Extract text
        content = response.content[0].text

        # Add to conversation
        self.state.messages.append(ConversationMessage(
            role="assistant",
            content=content,
        ))

        return content

    def _call_openai(self) -> str:
        """Call OpenAI API."""
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ] + [
            {"role": msg.role, "content": msg.content}
            for msg in self.state.messages
        ]

        response = self.client.chat.completions.create(
            model=self._get_openai_model(),
            max_tokens=4096,
            messages=messages,
        )

        # Track tokens
        if response.usage:
            self.state.input_tokens += response.usage.prompt_tokens
            self.state.output_tokens += response.usage.completion_tokens

        # Extract text
        content = response.choices[0].message.content

        # Add to conversation
        self.state.messages.append(ConversationMessage(
            role="assistant",
            content=content,
        ))

        return content

    def _get_anthropic_model(self) -> str:
        """Map model name to Anthropic model ID."""
        model_map = {
            "claude-sonnet-4-5": "claude-sonnet-4-5-20250514",
            "claude-opus-4-5": "claude-opus-4-5-20250514",
            "claude-haiku-4-5": "claude-haiku-4-5-20250514",
            "sonnet": "claude-sonnet-4-5-20250514",
            "opus": "claude-opus-4-5-20250514",
            "haiku": "claude-haiku-4-5-20250514",
        }
        return model_map.get(self.model, self.model)

    def _get_openai_model(self) -> str:
        """Map model name to OpenAI model ID."""
        model_map = {
            "gpt-5": "gpt-5",
            "gpt-5-mini": "gpt-5-mini",
            "gpt-4o": "gpt-4o",
        }
        return model_map.get(self.model, self.model)

    def _extract_command(self, response: str) -> Optional[str]:
        """Extract bash command from LLM response."""
        # Look for ```bash ... ``` blocks
        pattern = r"```(?:bash|sh)?\s*\n(.*?)\n```"
        matches = re.findall(pattern, response, re.DOTALL)

        if matches:
            # Return first command (single command per iteration)
            command = matches[0].strip()
            # Only take first line if multiple
            if '\n' in command:
                command = command.split('\n')[0].strip()
            return command

        return None

    def _execute_command(self, command: str, session: TmuxSession) -> str:
        """Execute command in tmux session and return output."""
        logger.info(f"Executing: {command[:80]}...")

        self.state.commands_executed.append(command)

        # Send command
        session.send_keys(command)

        # Wait for command to complete
        time.sleep(0.5)
        max_wait = 60  # 60 seconds max per command
        waited = 0

        while session.is_busy() and waited < max_wait:
            time.sleep(0.5)
            waited += 0.5

        # Get output
        output = session.get_output()

        # Truncate if too long
        max_output = 8000
        if len(output) > max_output:
            output = output[:max_output] + f"\n... (truncated, {len(output)} chars total)"

        return output

    def _save_logs(self, logging_dir: Path) -> None:
        """Save execution logs."""
        logging_dir.mkdir(parents=True, exist_ok=True)

        # Save conversation
        conv_path = logging_dir / "conversation.json"
        with open(conv_path, 'w') as f:
            json.dump(
                [{"role": m.role, "content": m.content} for m in self.state.messages],
                f,
                indent=2,
            )

        # Save commands
        cmds_path = logging_dir / "commands.json"
        with open(cmds_path, 'w') as f:
            json.dump(self.state.commands_executed, f, indent=2)

        # Save summary
        summary_path = logging_dir / "summary.json"
        with open(summary_path, 'w') as f:
            json.dump({
                "input_tokens": self.state.input_tokens,
                "output_tokens": self.state.output_tokens,
                "iterations": self.state.iterations,
                "commands_count": len(self.state.commands_executed),
                "model": self.model,
                "provider": self.provider,
            }, f, indent=2)
