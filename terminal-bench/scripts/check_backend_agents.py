#!/usr/bin/env python3
"""
Check available agents and their configurations in the TODOforAI backend.
"""

import asyncio
import json
from todoforai_edge.edge import TODOforAIEdge
from todoforai_edge.config import Config
from todoforai_tbench.config import load_config


async def main():
    tbench_config = load_config()

    cfg = Config()
    cfg.api_url = tbench_config.api_url
    cfg.api_key = tbench_config.api_key

    print(f"Connecting to: {cfg.api_url}")
    print(f"Project ID: {tbench_config.project_id}")
    print(f"Default agent: {tbench_config.default_agent}")
    print()

    edge = TODOforAIEdge(cfg)
    agents = await edge.list_agent_settings()

    print(f"Found {len(agents)} agents:\n")

    for agent in agents:
        name = agent.get("name", "unnamed")
        agent_id = agent.get("id", "no-id")
        model = agent.get("model", "unknown")
        permissions = agent.get("permissions", {})

        print(f"=== {name} ===")
        print(f"  ID: {agent_id}")
        print(f"  Model: {model}")

        allow = permissions.get("allow", [])
        if allow:
            print(f"  Allowed permissions ({len(allow)}):")
            for perm in allow:
                print(f"    - {perm}")

        deny = permissions.get("deny", [])
        if deny:
            print(f"  Denied permissions:")
            for perm in deny:
                print(f"    - {perm}")

        # Check for edge configs
        mcp_configs = agent.get("mcpConfigs", {})
        edges_mcp = agent.get("edgesMcpConfigs", {})
        if mcp_configs:
            print(f"  MCP Configs: {json.dumps(mcp_configs, indent=4)}")
        if edges_mcp:
            print(f"  Edges MCP Configs: {json.dumps(edges_mcp, indent=4)}")

        print()


if __name__ == "__main__":
    asyncio.run(main())
