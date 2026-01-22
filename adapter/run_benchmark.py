#!/usr/bin/env python3
"""
Mind2Web Benchmark Runner using todoai-cli

Pipes Mind2Web tasks through your todoai system and collects results
for WebJudge evaluation.

Usage:
    # Run all tasks (with confirmation each)
    python run_benchmark.py

    # Run first 5 tasks, skip confirmation
    python run_benchmark.py --limit 5 -y

    # Resume incomplete tasks
    python run_benchmark.py --resume

    # Specify project/agent
    python run_benchmark.py -p PROJECT_ID -a browsing
"""

import argparse
import json
import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any

sys.path.insert(0, str(Path(__file__).parent))
from mind2web_adapter import Mind2WebBenchmark, Task


class TodoAIRunner:
    """Runs Mind2Web tasks through todoai-cli."""

    def __init__(
        self,
        benchmark: Mind2WebBenchmark,
        project: Optional[str] = None,
        agent: Optional[str] = None,
        timeout: int = 300,
        skip_confirm: bool = False,
        output_json: bool = True
    ):
        self.benchmark = benchmark
        self.project = project
        self.agent = agent
        self.timeout = timeout
        self.skip_confirm = skip_confirm
        self.output_json = output_json

    def build_prompt(self, task: Task) -> str:
        """Build the prompt to send to todoai-cli."""
        prompt = f"""## Mind2Web Benchmark Task

**Task ID:** {task.task_id}

**Task:** {task.description}

**Instructions:**
1. Complete the task described above using web browsing
2. Take screenshots at each step
3. Log your actions and reasoning
4. Report success or failure with final URL/result

**Important:** This is a benchmark evaluation task. Focus on completing the exact task as described.
"""
        return prompt

    def run_task(self, task: Task) -> Dict[str, Any]:
        """Run a single task through todoai-cli."""
        prompt = self.build_prompt(task)

        cmd = ["todoai-cli"]

        if self.project:
            cmd.extend(["-p", self.project])
        if self.agent:
            cmd.extend(["-a", self.agent])
        if self.skip_confirm:
            cmd.append("-y")
        if self.output_json:
            cmd.append("--json")
        cmd.extend(["--timeout", str(self.timeout)])
        cmd.extend(["--todo-id", task.task_id])

        print(f"\n{'='*60}")
        print(f"Task: {task.description[:60]}...")
        print(f"ID: {task.task_id}")
        print(f"Running: {' '.join(cmd[:4])}...")

        try:
            result = subprocess.run(
                cmd,
                input=prompt,
                capture_output=True,
                text=True,
                timeout=self.timeout + 30  # Extra buffer
            )

            output = result.stdout
            error = result.stderr

            # Try to parse JSON result
            if self.output_json and output.strip():
                try:
                    parsed = json.loads(output)
                    return {
                        "success": True,
                        "task_id": task.task_id,
                        "output": parsed,
                        "raw_stdout": output,
                        "raw_stderr": error
                    }
                except json.JSONDecodeError:
                    pass

            return {
                "success": result.returncode == 0,
                "task_id": task.task_id,
                "output": output,
                "raw_stdout": output,
                "raw_stderr": error,
                "returncode": result.returncode
            }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "task_id": task.task_id,
                "error": "Timeout expired",
                "output": None
            }
        except Exception as e:
            return {
                "success": False,
                "task_id": task.task_id,
                "error": str(e),
                "output": None
            }

    def save_result(self, task: Task, result: Dict[str, Any]) -> Path:
        """Save result in Mind2Web format for evaluation."""
        task_dir = self.benchmark.output_dir / task.task_id
        task_dir.mkdir(parents=True, exist_ok=True)

        # Convert todoai result to Mind2Web format
        mind2web_result = {
            "task_id": task.task_id,
            "task": task.description,
            "action_history": [],  # Will be populated from agent output
            "thoughts": [],
            "final_result_response": ""
        }

        # Extract data from todoai output if available
        if result.get("output"):
            output = result["output"]
            if isinstance(output, dict):
                # Try to extract structured data
                mind2web_result["final_result_response"] = output.get(
                    "result", output.get("response", str(output))
                )
                if "actions" in output:
                    mind2web_result["action_history"] = output["actions"]
                if "thoughts" in output:
                    mind2web_result["thoughts"] = output["thoughts"]
            else:
                mind2web_result["final_result_response"] = str(output)

        # Add metadata
        mind2web_result["_todoai_result"] = result
        mind2web_result["_timestamp"] = datetime.now().isoformat()

        # Save result.json
        result_path = task_dir / "result.json"
        with open(result_path, 'w') as f:
            json.dump(mind2web_result, f, indent=2)

        return result_path

    def run_all(
        self,
        tasks: Optional[List[Task]] = None,
        resume: bool = True
    ) -> Dict[str, int]:
        """Run all tasks and collect results."""
        if tasks is None:
            if resume:
                tasks = self.benchmark.get_incomplete_tasks()
            else:
                tasks = self.benchmark.tasks

        stats = {"success": 0, "failure": 0, "error": 0}

        print(f"Running {len(tasks)} tasks through todoai-cli...")

        for i, task in enumerate(tasks):
            print(f"\n[{i+1}/{len(tasks)}]", end=" ")

            result = self.run_task(task)
            self.save_result(task, result)

            if result.get("error"):
                stats["error"] += 1
                print(f"  ERROR: {result['error']}")
            elif result.get("success"):
                stats["success"] += 1
                print(f"  Done")
            else:
                stats["failure"] += 1
                print(f"  Failed")

        print(f"\n{'='*60}")
        print(f"Completed: {stats}")
        return stats


def main():
    parser = argparse.ArgumentParser(
        description="Run Mind2Web benchmark through todoai-cli"
    )
    parser.add_argument(
        "--project", "-p",
        help="Project ID for todoai-cli"
    )
    parser.add_argument(
        "--agent", "-a",
        help="Agent name for todoai-cli"
    )
    parser.add_argument(
        "--limit", "-n",
        type=int,
        help="Limit number of tasks to run"
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from incomplete tasks only"
    )
    parser.add_argument(
        "--yes", "-y",
        action="store_true",
        help="Skip confirmation prompts"
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=300,
        help="Timeout per task in seconds (default: 300)"
    )
    parser.add_argument(
        "--output-dir", "-o",
        help="Output directory for results"
    )
    parser.add_argument(
        "--task-id",
        help="Run a specific task by ID"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be run without executing"
    )

    args = parser.parse_args()

    # Load benchmark
    benchmark = Mind2WebBenchmark(
        output_dir=Path(args.output_dir) if args.output_dir else None
    )

    # Select tasks
    if args.task_id:
        task = benchmark.get_task(args.task_id)
        if not task:
            # Try partial match
            matches = [t for t in benchmark.tasks if args.task_id in t.task_id]
            if len(matches) == 1:
                task = matches[0]
            else:
                print(f"Task not found: {args.task_id}")
                return 1
        tasks = [task]
    elif args.resume:
        tasks = benchmark.get_incomplete_tasks()
    else:
        tasks = benchmark.tasks

    if args.limit:
        tasks = tasks[:args.limit]

    print(f"Selected {len(tasks)} tasks")

    if args.dry_run:
        print("\nDry run - would execute:")
        for t in tasks[:5]:
            print(f"  - {t.task_id}: {t.description[:50]}...")
        if len(tasks) > 5:
            print(f"  ... and {len(tasks) - 5} more")
        return 0

    # Run
    runner = TodoAIRunner(
        benchmark=benchmark,
        project=args.project,
        agent=args.agent,
        timeout=args.timeout,
        skip_confirm=args.yes
    )

    stats = runner.run_all(tasks, resume=args.resume)

    # Show next steps
    print("\nNext steps:")
    print(f"  1. Check results in: {benchmark.output_dir}")
    print(f"  2. Run evaluation: python cli.py eval")

    return 0 if stats["error"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
