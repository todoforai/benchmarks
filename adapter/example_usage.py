#!/usr/bin/env python3
"""
Example: How to use the Mind2Web adapter with your agent.

This file demonstrates the integration pattern. Replace the mock agent
with your actual agent implementation.
"""

import sys
from pathlib import Path

# Add adapter to path
sys.path.insert(0, str(Path(__file__).parent))

from mind2web_adapter import Mind2WebBenchmark, Task, TaskRunner, Action


# =============================================================================
# Option 1: Manual loop (full control)
# =============================================================================

def run_single_task_manually():
    """Example of running a single task with full control over the loop."""

    # Load benchmark
    benchmark = Mind2WebBenchmark(
        output_dir=Path(__file__).parent.parent / "my_agent_outputs"
    )

    # Get first task
    task = benchmark.tasks[0]
    print(f"Task: {task.description}")

    # Create runner for this task
    runner = benchmark.create_runner(task)

    # === YOUR AGENT CODE HERE ===

    # 1. Initialize browser and take initial screenshot
    # browser = YourBrowser()
    # browser.navigate(task.start_url)
    # runner.screenshot(browser.screenshot())

    # 2. Agent loop
    # while not done:
    #     # Agent thinks
    #     thought = your_agent.think(browser.get_state())
    #     runner.add_thought(thought)
    #
    #     # Agent decides action
    #     action = your_agent.decide_action(thought)
    #     runner.add_action({
    #         "type": action.type,        # "click", "type", etc.
    #         "selector": action.target,   # CSS selector or description
    #         "value": action.value        # For type actions
    #     })
    #
    #     # Execute action
    #     browser.execute(action)
    #
    #     # Screenshot after action
    #     runner.screenshot(browser.screenshot())
    #
    #     # Check if done
    #     done = your_agent.is_task_complete()

    # 3. Mark complete
    # runner.complete(
    #     status="success",
    #     final_response="Successfully completed the task",
    #     url=browser.current_url
    # )

    # === MOCK EXAMPLE (remove this) ===
    runner.add_thought("Analyzing the task...")
    runner.add_action('<button id="submit"> -> CLICK')
    runner.complete(status="success", final_response="Mock completion")

    print(f"Saved results to: {runner.output_dir}")


# =============================================================================
# Option 2: Using run_all with agent function
# =============================================================================

def my_agent_function(task: Task, runner: TaskRunner):
    """
    Your agent implementation.

    This function is called for each task. Use the runner to log
    screenshots, actions, and thoughts.
    """
    # Initialize your browser/environment
    # browser = YourBrowser()

    # Navigate to starting point (you may need to determine this from task)
    # browser.navigate("https://example.com")

    # Take initial screenshot
    # runner.screenshot(browser.screenshot())

    # Your agent loop
    max_steps = 10
    for step in range(max_steps):
        # Get current state
        # state = browser.get_state()

        # Agent reasoning
        thought = f"Step {step}: Analyzing current state and deciding next action..."
        runner.add_thought(thought)

        # Agent action
        action = Action(
            action_type="click",
            selector=f"button#step-{step}",
            description=f"Click button for step {step}"
        )
        runner.add_action(action)

        # Execute and screenshot
        # browser.execute(action)
        # runner.screenshot(browser.screenshot())

        # Check completion (your logic here)
        if step >= 3:  # Mock: complete after 3 steps
            break

    # Mark task complete
    runner.complete(
        status="success",
        final_response=f"Completed task: {task.description}",
        url="https://example.com/result"
    )


def run_all_tasks():
    """Example of running all tasks using the run_all method."""

    benchmark = Mind2WebBenchmark(
        output_dir=Path(__file__).parent.parent / "my_agent_outputs"
    )

    # Run on first 5 tasks only (for testing)
    results = benchmark.run_all(
        agent_fn=my_agent_function,
        resume=True,  # Skip already completed tasks
        max_tasks=5   # Limit for testing
    )

    print(f"Results: {results}")


# =============================================================================
# Option 3: Running evaluation
# =============================================================================

def run_evaluation():
    """Example of running WebJudge evaluation on completed tasks."""
    import os

    benchmark = Mind2WebBenchmark(
        output_dir=Path(__file__).parent.parent / "my_agent_outputs"
    )

    # Check completed tasks
    completed = benchmark.get_completed_tasks()
    print(f"Completed tasks: {len(completed)}/{len(benchmark.tasks)}")

    if len(completed) == 0:
        print("No completed tasks to evaluate. Run some tasks first!")
        return

    # Run evaluation (requires OPENAI_API_KEY)
    if not os.environ.get("OPENAI_API_KEY"):
        print("Set OPENAI_API_KEY environment variable to run evaluation")
        return

    eval_results_path = benchmark.evaluate(
        model="gpt-4o-mini",
        score_threshold=3,
        num_workers=1
    )

    print(f"Evaluation results saved to: {eval_results_path}")

    # Compare with human labels
    comparison = benchmark.compare_with_human_labels(eval_results_path)
    print(f"Evaluated {comparison['total_evaluated']} tasks")


# =============================================================================
# Integration with your existing Todo system
# =============================================================================

def integrate_with_todo_system():
    """
    Example showing how Mind2Web tasks map to your todo system.

    Each Mind2Web task can be treated as a todo item:
    - task_id -> todo.id
    - description -> todo.content
    - in_progress/completed -> todo.status
    """

    benchmark = Mind2WebBenchmark()

    # Convert Mind2Web tasks to your todo format
    todos = []
    for task in benchmark.tasks[:10]:  # First 10 for example
        todo = {
            "id": task.task_id,
            "content": task.description,
            "status": "pending",
            "activeForm": f"Working on: {task.description[:50]}...",
            # Store original task for reference
            "_mind2web_task": task.to_dict()
        }
        todos.append(todo)

    print(f"Created {len(todos)} todos from Mind2Web tasks")

    # Example: process todos
    for todo in todos:
        print(f"- [{todo['status']}] {todo['content'][:60]}...")


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Mind2Web Adapter Examples")
    parser.add_argument("--mode", choices=["single", "all", "eval", "todos"],
                       default="single", help="Example to run")
    args = parser.parse_args()

    if args.mode == "single":
        run_single_task_manually()
    elif args.mode == "all":
        run_all_tasks()
    elif args.mode == "eval":
        run_evaluation()
    elif args.mode == "todos":
        integrate_with_todo_system()
