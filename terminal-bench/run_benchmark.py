#!/usr/bin/env python3
"""
Terminal-Bench Runner for TODOforAI

Wrapper script for running Terminal-Bench evaluations with TODOforAI agents.

Usage:
    # Run single task
    python run_benchmark.py --task-id hello-world

    # Run full benchmark
    python run_benchmark.py --dataset terminal-bench-core

    # Run with specific model
    python run_benchmark.py --model claude-sonnet-4-5

    # Run Terminal-Bench 2.0
    python run_benchmark.py --dataset terminal-bench@2.0 --concurrent 8
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any


def run_tb_command(args: List[str], capture: bool = False) -> subprocess.CompletedProcess:
    """Run a tb CLI command."""
    cmd = ["tb"] + args

    if capture:
        return subprocess.run(cmd, capture_output=True, text=True)
    else:
        return subprocess.run(cmd)


def get_agent_import_path(agent_type: str) -> str:
    """Get the import path for an agent type."""
    agent_map = {
        "default": "todoforai_tbench:TODOforAIAgent",
        "installed": "todoforai_tbench:TODOforAIInstalledAgent",
        "minimal": "todoforai_tbench:TODOforAIInstalledAgentMinimal",
    }
    return agent_map.get(agent_type, agent_type)


def run_benchmark(
    dataset: str = "terminal-bench-core",
    version: str = "head",
    agent_type: str = "default",
    model: Optional[str] = None,
    task_id: Optional[str] = None,
    concurrent: int = 1,
    timeout: int = 600,
    output_dir: Optional[str] = None,
    dry_run: bool = False,
) -> int:
    """Run Terminal-Bench evaluation."""

    # Build command
    cmd_args = ["run"]

    # Dataset
    if "@" in dataset:
        cmd_args.extend(["--dataset", dataset])
    else:
        cmd_args.extend(["--dataset", f"{dataset}=={version}"])

    # Agent
    agent_import = get_agent_import_path(agent_type)
    cmd_args.extend(["--agent-import-path", agent_import])

    # Model (if specified, set via env var)
    if model:
        os.environ["TODOFORAI_MODEL"] = model

    # Single task or full run
    if task_id:
        cmd_args.extend(["--task-id", task_id])
    else:
        cmd_args.extend(["--n-concurrent", str(concurrent)])

    # Output directory
    if output_dir:
        os.environ["TODOFORAI_OUTPUT_DIR"] = output_dir

    # Timeout
    os.environ["TODOFORAI_TIMEOUT"] = str(timeout)

    print(f"Running: tb {' '.join(cmd_args)}")

    if dry_run:
        print("(dry run - not executing)")
        return 0

    result = run_tb_command(cmd_args)
    return result.returncode


def check_installation() -> bool:
    """Check if Terminal-Bench is installed."""
    try:
        result = subprocess.run(
            ["tb", "--version"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except FileNotFoundError:
        return False


def install_terminal_bench() -> None:
    """Install Terminal-Bench."""
    print("Installing Terminal-Bench...")

    # Try uv first
    try:
        subprocess.run(["uv", "tool", "install", "terminal-bench"], check=True)
        return
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    # Fall back to pip
    subprocess.run([sys.executable, "-m", "pip", "install", "terminal-bench"], check=True)


def list_datasets() -> None:
    """List available datasets."""
    print("Available datasets:\n")
    print("  terminal-bench-core    - Core benchmark (80 tasks)")
    print("  terminal-bench@2.0     - Terminal-Bench 2.0 (89 tasks, harder)")
    print("\nUse --dataset <name> to select.")


def list_agents() -> None:
    """List available agent types."""
    print("Available agent types:\n")
    print("  default    - Full TODOforAI via Edge/Backend (recommended)")
    print("  installed  - Installs in container (for leaderboard)")
    print("  minimal    - Lightweight installed agent")
    print("\nUse --agent <type> to select.")


def main():
    parser = argparse.ArgumentParser(
        description="Run Terminal-Bench with TODOforAI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --task-id hello-world              # Test single task
  %(prog)s --dataset terminal-bench-core      # Run full benchmark
  %(prog)s --agent installed                  # Use installed agent (for Docker)
  %(prog)s --concurrent 8                     # Run 8 tasks in parallel
        """,
    )

    parser.add_argument(
        "--dataset", "-d",
        default="terminal-bench-core",
        help="Dataset to run (default: terminal-bench-core)",
    )
    parser.add_argument(
        "--version", "-v",
        default="head",
        help="Dataset version (default: head)",
    )
    parser.add_argument(
        "--agent", "-a",
        default="default",
        help="Agent type: default, installed, minimal",
    )
    parser.add_argument(
        "--model", "-m",
        help="Model to use (e.g., claude-sonnet-4-5, gpt-5)",
    )
    parser.add_argument(
        "--task-id", "-t",
        help="Run a specific task by ID",
    )
    parser.add_argument(
        "--concurrent", "-n",
        type=int,
        default=1,
        help="Number of concurrent tasks (default: 1)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Timeout per task in seconds (default: 600)",
    )
    parser.add_argument(
        "--output-dir", "-o",
        help="Output directory for results",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print command without executing",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Install Terminal-Bench if not present",
    )
    parser.add_argument(
        "--list-datasets",
        action="store_true",
        help="List available datasets",
    )
    parser.add_argument(
        "--list-agents",
        action="store_true",
        help="List available agent types",
    )

    args = parser.parse_args()

    # Handle info commands
    if args.list_datasets:
        list_datasets()
        return 0

    if args.list_agents:
        list_agents()
        return 0

    # Check/install Terminal-Bench
    if not check_installation():
        if args.install:
            install_terminal_bench()
        else:
            print("Terminal-Bench not installed. Run with --install or:")
            print("  pip install terminal-bench")
            return 1

    # Run benchmark
    return run_benchmark(
        dataset=args.dataset,
        version=args.version,
        agent_type=args.agent,
        model=args.model,
        task_id=args.task_id,
        concurrent=args.concurrent,
        timeout=args.timeout,
        output_dir=args.output_dir,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    sys.exit(main())
