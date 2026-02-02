#!/usr/bin/env python3
"""
Test the TODOforAI agent directly without terminal-bench.
Creates a mock TmuxSession to see what commands would be executed.
"""

import asyncio
from todoforai_tbench.agent import TODOforAIAgent
from todoforai_tbench.config import load_config


class MockTmuxSession:
    """Mock TmuxSession that prints commands instead of executing them."""

    def __init__(self):
        self.commands = []

    def send_keys(self, keys, block=False, max_timeout_sec=120, min_timeout_sec=0):
        print(f"[MockTmux] send_keys: {keys!r}")
        self.commands.append(keys)


async def test_agent(task: str):
    """Run a test task through the agent."""
    config = load_config()
    print(f"Config: api_url={config.api_url}, agent={config.default_agent}")

    agent = TODOforAIAgent(config)
    session = MockTmuxSession()

    print(f"\n=== Running task ===\n{task}\n")

    await agent._run_task_with_edge(task, session)

    print(f"\n=== Commands executed ===")
    for i, cmd in enumerate(session.commands, 1):
        print(f"  {i}. {cmd}")

    print(f"\n=== Stats ===")
    print(f"  Tool calls: {len(agent.tool_calls)}")
    print(f"  Input tokens: {agent.total_input_tokens}")
    print(f"  Output tokens: {agent.total_output_tokens}")


if __name__ == "__main__":
    import sys
    task = sys.argv[1] if len(sys.argv) > 1 else "List files in the current directory"
    asyncio.run(test_agent(task))
