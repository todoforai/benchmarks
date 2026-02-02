#!/usr/bin/env python3
"""
Test the edge client with tool serving capabilities.
This helps understand how the full edge integration works.
"""

import asyncio
import inspect
from todoforai_edge.edge import TODOforAIEdge
from todoforai_edge.config import Config
from todoforai_tbench.config import load_config


async def main():
    tbench_config = load_config()

    cfg = Config()
    cfg.api_url = tbench_config.api_url
    cfg.api_key = tbench_config.api_key

    print("=== TODOforAIEdge API ===\n")

    # List all public methods
    edge = TODOforAIEdge(cfg)

    print("Methods:")
    for name in dir(edge):
        if name.startswith("_"):
            continue
        attr = getattr(edge, name)
        if callable(attr):
            try:
                sig = inspect.signature(attr)
                print(f"  {name}{sig}")
            except (ValueError, TypeError):
                print(f"  {name}(...)")

    print("\nAttributes:")
    for name in dir(edge):
        if name.startswith("_"):
            continue
        attr = getattr(edge, name)
        if not callable(attr):
            print(f"  {name}: {type(attr).__name__} = {repr(attr)[:80]}")

    # Check if there's a way to start tool serving
    print("\n=== Looking for tool-related methods ===")
    for name in dir(edge):
        if any(x in name.lower() for x in ["tool", "bash", "shell", "exec", "run", "start", "serve"]):
            print(f"  Found: {name}")


if __name__ == "__main__":
    asyncio.run(main())
