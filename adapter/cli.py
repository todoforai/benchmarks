#!/usr/bin/env python3
"""
Mind2Web Benchmark CLI

Quick access to benchmark tasks and evaluation.

Usage:
    python cli.py list                    # List all tasks
    python cli.py list --limit 10         # List first 10 tasks
    python cli.py show TASK_ID            # Show task details
    python cli.py status                  # Show completion status
    python cli.py eval                    # Run evaluation
    python cli.py export --format json    # Export tasks to JSON/CSV
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from mind2web_adapter import Mind2WebBenchmark, load_benchmark


def cmd_list(args):
    """List all benchmark tasks."""
    benchmark = load_benchmark(args.output_dir)

    tasks = benchmark.tasks
    if args.limit:
        tasks = tasks[:args.limit]

    if args.incomplete:
        tasks = [t for t in tasks if t in benchmark.get_incomplete_tasks()]

    if args.completed:
        tasks = [t for t in tasks if t in benchmark.get_completed_tasks()]

    for i, task in enumerate(tasks):
        status = "✓" if task in benchmark.get_completed_tasks() else "○"
        print(f"{status} [{i+1}] {task.task_id[:12]}... | {task.description[:70]}")

    print(f"\nTotal: {len(tasks)} tasks")


def cmd_show(args):
    """Show details for a specific task."""
    benchmark = load_benchmark(args.output_dir)

    task = benchmark.get_task(args.task_id)
    if not task:
        # Try partial match
        matches = [t for t in benchmark.tasks if args.task_id in t.task_id]
        if len(matches) == 1:
            task = matches[0]
        elif len(matches) > 1:
            print(f"Multiple matches found:")
            for t in matches:
                print(f"  {t.task_id}")
            return
        else:
            print(f"Task not found: {args.task_id}")
            return

    print(f"Task ID: {task.task_id}")
    print(f"Description: {task.description}")
    print(f"\nHuman Labels:")
    for agent, label in task.human_labels.items():
        status = {"0": "❌ Failure", "1": "✅ Success", "2": "⚠️ Not Executable"}.get(label, label)
        print(f"  {agent.replace('_human_label', '')}: {status}")

    # Check if we have results
    result_path = benchmark.output_dir / task.task_id / "result.json"
    if result_path.exists():
        print(f"\n--- Your Agent's Result ---")
        with open(result_path) as f:
            result = json.load(f)
        print(f"Actions: {len(result.get('action_history', []))}")
        print(f"Thoughts: {len(result.get('thoughts', []))}")
        print(f"Final Response: {result.get('final_result_response', 'N/A')[:100]}")


def cmd_status(args):
    """Show benchmark completion status."""
    benchmark = load_benchmark(args.output_dir)

    completed = benchmark.get_completed_tasks()
    incomplete = benchmark.get_incomplete_tasks()

    print(f"Mind2Web Benchmark Status")
    print(f"=" * 40)
    print(f"Total tasks:     {len(benchmark.tasks)}")
    print(f"Completed:       {len(completed)} ({100*len(completed)/len(benchmark.tasks):.1f}%)")
    print(f"Remaining:       {len(incomplete)}")
    print(f"Output dir:      {benchmark.output_dir}")

    if args.verbose and completed:
        print(f"\nRecently completed:")
        for task in completed[-5:]:
            print(f"  ✓ {task.task_id[:12]}... | {task.description[:50]}")


def cmd_eval(args):
    """Run WebJudge evaluation."""
    import os

    benchmark = load_benchmark(args.output_dir)

    completed = benchmark.get_completed_tasks()
    if len(completed) == 0:
        print("No completed tasks to evaluate. Run some tasks first!")
        return

    api_key = args.api_key or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY required. Set environment variable or use --api-key")
        return

    print(f"Evaluating {len(completed)} completed tasks...")

    eval_results_path = benchmark.evaluate(
        model=args.model,
        score_threshold=args.threshold,
        num_workers=args.workers,
        api_key=api_key
    )

    print(f"\nResults saved to: {eval_results_path}")

    # Show summary
    if eval_results_path.exists():
        with open(eval_results_path) as f:
            results = [json.loads(line) for line in f if line.strip()]

        success = sum(1 for r in results if r.get("predicted_label") == 1)
        print(f"\nSuccess rate: {success}/{len(results)} ({100*success/len(results):.1f}%)")


def cmd_export(args):
    """Export tasks to JSON or CSV."""
    benchmark = load_benchmark(args.output_dir)

    if args.format == "json":
        output = [task.to_dict() for task in benchmark.tasks]
        print(json.dumps(output, indent=2))

    elif args.format == "csv":
        print("task_id,description")
        for task in benchmark.tasks:
            desc = task.description.replace('"', '""')
            print(f'{task.task_id},"{desc}"')

    elif args.format == "tasks":
        # Export as simple task list for your agent
        for task in benchmark.tasks:
            print(json.dumps({
                "id": task.task_id,
                "task": task.description
            }))


def main():
    parser = argparse.ArgumentParser(description="Mind2Web Benchmark CLI")
    parser.add_argument("--output-dir", "-o", help="Output directory for agent results")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # list
    p_list = subparsers.add_parser("list", help="List benchmark tasks")
    p_list.add_argument("--limit", "-n", type=int, help="Limit number of tasks")
    p_list.add_argument("--incomplete", "-i", action="store_true", help="Show only incomplete")
    p_list.add_argument("--completed", "-c", action="store_true", help="Show only completed")
    p_list.set_defaults(func=cmd_list)

    # show
    p_show = subparsers.add_parser("show", help="Show task details")
    p_show.add_argument("task_id", help="Task ID (can be partial)")
    p_show.set_defaults(func=cmd_show)

    # status
    p_status = subparsers.add_parser("status", help="Show completion status")
    p_status.add_argument("--verbose", "-v", action="store_true")
    p_status.set_defaults(func=cmd_status)

    # eval
    p_eval = subparsers.add_parser("eval", help="Run WebJudge evaluation")
    p_eval.add_argument("--model", "-m", default="gpt-4o-mini", help="Model for evaluation")
    p_eval.add_argument("--threshold", "-t", type=int, default=3, help="Score threshold (1-5)")
    p_eval.add_argument("--workers", "-w", type=int, default=1, help="Number of workers")
    p_eval.add_argument("--api-key", help="OpenAI API key")
    p_eval.set_defaults(func=cmd_eval)

    # export
    p_export = subparsers.add_parser("export", help="Export tasks")
    p_export.add_argument("--format", "-f", choices=["json", "csv", "tasks"],
                         default="json", help="Export format")
    p_export.set_defaults(func=cmd_export)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    args.func(args)


if __name__ == "__main__":
    main()
