"""
Mind2Web Benchmark Adapter

This adapter provides an interface to run your agent against the Online-Mind2Web benchmark
and produce output in the format expected by WebJudge evaluation.

Usage:
    from mind2web_adapter import Mind2WebBenchmark, TaskRunner

    # Load all 300 tasks
    benchmark = Mind2WebBenchmark()

    # Run your agent on each task
    for task in benchmark.tasks:
        runner = benchmark.create_runner(task)

        # Your agent loop
        runner.screenshot(browser.screenshot())  # Initial state

        while not done:
            thought = your_agent.think(state)
            runner.add_thought(thought)

            action = your_agent.act(thought)
            runner.add_action(action)

            browser.execute(action)
            runner.screenshot(browser.screenshot())

        runner.complete(status="success", final_response="Task completed...")

    # Run evaluation
    benchmark.evaluate(model="gpt-4o-mini")
"""

import json
import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Any, Callable
from dataclasses import dataclass, field, asdict
from PIL import Image
import io
import base64


@dataclass
class Task:
    """Represents a Mind2Web benchmark task."""
    task_id: str
    description: str
    human_labels: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "task_id": self.task_id,
            "task": self.description,
            "human_labels": self.human_labels
        }


@dataclass
class Action:
    """Represents an agent action."""
    action_type: str  # "click", "type", "scroll", "navigate", etc.
    selector: str     # CSS selector or element description
    value: Optional[str] = None  # For type actions
    description: Optional[str] = None

    def to_mind2web_format(self) -> str:
        """Convert to Mind2Web action history format."""
        if self.value:
            return f"<{self.selector}> -> {self.action_type.upper()}: {self.value}"
        return f"<{self.selector}> -> {self.action_type.upper()}"


class TaskRunner:
    """
    Runs a single task and collects trajectory data.

    This class manages:
    - Screenshot capture and storage
    - Action history logging
    - Thought/reasoning logging
    - Result generation
    """

    def __init__(self, task: Task, output_dir: Path):
        self.task = task
        self.output_dir = output_dir
        self.trajectory_dir = output_dir / "trajectory"

        # Create directories
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.trajectory_dir.mkdir(parents=True, exist_ok=True)

        # State tracking
        self.actions: List[str] = []
        self.thoughts: List[str] = []
        self.screenshot_count = 0
        self.start_time = datetime.now()
        self.completed = False
        self.final_result: Optional[Dict] = None

    def screenshot(self, image: Any, suffix: str = "full_screenshot") -> str:
        """
        Save a screenshot to the trajectory.

        Args:
            image: PIL Image, bytes, base64 string, or file path
            suffix: Filename suffix (default: "full_screenshot")

        Returns:
            Path to saved screenshot
        """
        filename = f"{self.screenshot_count}_{suffix}.png"
        filepath = self.trajectory_dir / filename

        if isinstance(image, (str, Path)):
            if os.path.exists(image):
                shutil.copy(image, filepath)
            elif isinstance(image, str) and len(image) > 1000:
                # Assume base64
                img_data = base64.b64decode(image)
                with open(filepath, 'wb') as f:
                    f.write(img_data)
        elif isinstance(image, bytes):
            with open(filepath, 'wb') as f:
                f.write(image)
        elif hasattr(image, 'save'):  # PIL Image
            image.save(filepath, 'PNG')
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")

        self.screenshot_count += 1
        return str(filepath)

    def add_action(self, action: Any) -> None:
        """
        Add an action to the history.

        Args:
            action: Can be:
                - Action object
                - String in Mind2Web format: "<selector> -> ACTION"
                - Dict with keys: type, selector, value (optional)
        """
        if isinstance(action, Action):
            self.actions.append(action.to_mind2web_format())
        elif isinstance(action, str):
            self.actions.append(action)
        elif isinstance(action, dict):
            act = Action(
                action_type=action.get('type', action.get('action_type', 'click')),
                selector=action.get('selector', action.get('element', '')),
                value=action.get('value'),
                description=action.get('description')
            )
            self.actions.append(act.to_mind2web_format())
        else:
            self.actions.append(str(action))

    def add_thought(self, thought: str) -> None:
        """Add a thought/reasoning step."""
        self.thoughts.append(thought)

    def complete(
        self,
        status: str = "success",
        final_response: Optional[str] = None,
        url: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict:
        """
        Mark task as complete and save result.json.

        Args:
            status: "success" or "failure"
            final_response: Final agent response/summary
            url: Final URL reached
            metadata: Additional metadata to include

        Returns:
            The result dictionary that was saved
        """
        self.completed = True

        result = {
            "task_id": self.task.task_id,
            "task": self.task.description,
            "action_history": self.actions,
            "thoughts": self.thoughts,
            "final_result_response": final_response or f"Task {status}",
        }

        # Add URL if provided
        if url:
            result["final_url"] = url

        # Add metadata
        if metadata:
            result.update(metadata)

        # Add timing info
        result["_metadata"] = {
            "start_time": self.start_time.isoformat(),
            "end_time": datetime.now().isoformat(),
            "num_actions": len(self.actions),
            "num_screenshots": self.screenshot_count
        }

        # Save result.json
        result_path = self.output_dir / "result.json"
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)

        self.final_result = result
        return result

    def fail(self, reason: str, error: Optional[Exception] = None) -> Dict:
        """Mark task as failed with reason."""
        metadata = {"failure_reason": reason}
        if error:
            metadata["error"] = str(error)
        return self.complete(status="failure", final_response=reason, metadata=metadata)


class Mind2WebBenchmark:
    """
    Main interface to the Mind2Web benchmark.

    Loads tasks, manages output directories, and runs evaluation.
    """

    def __init__(
        self,
        benchmark_dir: Optional[Path] = None,
        output_dir: Optional[Path] = None
    ):
        # Find benchmark directory
        if benchmark_dir is None:
            # Try to find it relative to this file
            # Structure: benchmarks/adapter/mind2web_adapter.py
            #            benchmarks/online-mind2web/data/
            self_dir = Path(__file__).parent.parent
            online_mind2web_dir = self_dir / "online-mind2web"
            if (online_mind2web_dir / "data").exists():
                benchmark_dir = online_mind2web_dir
            elif (self_dir / "data").exists():
                # Fallback: data directly in parent
                benchmark_dir = self_dir
            else:
                raise ValueError(
                    "Could not find benchmark data. Please either:\n"
                    "  1. Download data to benchmarks/online-mind2web/data/\n"
                    "  2. Specify benchmark_dir parameter"
                )

        self.benchmark_dir = Path(benchmark_dir)
        self.output_dir = Path(output_dir) if output_dir else self.benchmark_dir.parent / "results"

        # Load tasks
        self.tasks = self._load_tasks()
        self.tasks_by_id = {t.task_id: t for t in self.tasks}

        print(f"Loaded {len(self.tasks)} tasks from Mind2Web benchmark")

    def _load_tasks(self) -> List[Task]:
        """Load tasks from human_label.json."""
        human_label_path = (
            self.benchmark_dir /
            "data/evaluation_results/online_mind2web_evaluation_results/human_label.json"
        )

        if not human_label_path.exists():
            raise FileNotFoundError(f"Could not find human_label.json at {human_label_path}")

        with open(human_label_path) as f:
            data = json.load(f)

        tasks = []
        for item in data:
            human_labels = {
                k: v for k, v in item.items()
                if k.endswith('_human_label')
            }

            task = Task(
                task_id=item["task_id"],
                description=item["confirmed_task"],
                human_labels=human_labels
            )
            tasks.append(task)

        return tasks

    def create_runner(self, task: Task) -> TaskRunner:
        """Create a TaskRunner for the given task."""
        task_output_dir = self.output_dir / task.task_id
        return TaskRunner(task, task_output_dir)

    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        return self.tasks_by_id.get(task_id)

    def get_incomplete_tasks(self) -> List[Task]:
        """Get tasks that haven't been completed yet."""
        incomplete = []
        for task in self.tasks:
            result_path = self.output_dir / task.task_id / "result.json"
            if not result_path.exists():
                incomplete.append(task)
        return incomplete

    def get_completed_tasks(self) -> List[Task]:
        """Get tasks that have been completed."""
        completed = []
        for task in self.tasks:
            result_path = self.output_dir / task.task_id / "result.json"
            if result_path.exists():
                completed.append(task)
        return completed

    def run_all(
        self,
        agent_fn: Callable[[Task, TaskRunner], None],
        resume: bool = True,
        max_tasks: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Run the agent on all tasks.

        Args:
            agent_fn: Function that takes (task, runner) and executes the agent
            resume: If True, skip already completed tasks
            max_tasks: Maximum number of tasks to run (for testing)

        Returns:
            Summary statistics
        """
        tasks_to_run = self.get_incomplete_tasks() if resume else self.tasks

        if max_tasks:
            tasks_to_run = tasks_to_run[:max_tasks]

        print(f"Running {len(tasks_to_run)} tasks...")

        results = {"success": 0, "failure": 0, "error": 0}

        for i, task in enumerate(tasks_to_run):
            print(f"[{i+1}/{len(tasks_to_run)}] {task.task_id}: {task.description[:60]}...")

            runner = self.create_runner(task)

            try:
                agent_fn(task, runner)

                if runner.completed:
                    if "success" in str(runner.final_result.get("final_result_response", "")).lower():
                        results["success"] += 1
                    else:
                        results["failure"] += 1
                else:
                    runner.fail("Agent did not call complete()")
                    results["failure"] += 1

            except Exception as e:
                print(f"  Error: {e}")
                runner.fail(f"Exception: {str(e)}", error=e)
                results["error"] += 1

        print(f"\nCompleted: {results}")
        return results

    def evaluate(
        self,
        model: str = "gpt-4o-mini",
        mode: str = "WebJudge_Online_Mind2Web_eval",
        score_threshold: int = 3,
        num_workers: int = 1,
        api_key: Optional[str] = None
    ) -> Path:
        """
        Run WebJudge evaluation on completed tasks.

        Args:
            model: OpenAI model to use for evaluation
            mode: Evaluation mode
            score_threshold: Image relevance threshold (1-5)
            num_workers: Number of parallel workers
            api_key: OpenAI API key (or set OPENAI_API_KEY env var)

        Returns:
            Path to evaluation results file
        """
        import subprocess

        api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("API key required. Set OPENAI_API_KEY or pass api_key parameter.")

        eval_output_dir = self.output_dir / "evaluation_results"
        eval_output_dir.mkdir(exist_ok=True)

        cmd = [
            "python", str(self.benchmark_dir / "src/run.py"),
            "--mode", mode,
            "--model", model,
            "--trajectories_dir", str(self.output_dir),
            "--api_key", api_key,
            "--output_path", str(eval_output_dir),
            "--score_threshold", str(score_threshold),
            "--num_worker", str(num_workers)
        ]

        print(f"Running evaluation: {' '.join(cmd[:6])}...")
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            print(f"Evaluation failed: {result.stderr}")
            raise RuntimeError(f"Evaluation failed: {result.stderr}")

        print(result.stdout)

        # Find the output file
        output_file = eval_output_dir / f"{mode}_{model}_score_threshold_{score_threshold}_auto_eval_results.json"
        return output_file

    def compare_with_human_labels(self, eval_results_path: Path) -> Dict[str, Any]:
        """
        Compare evaluation results with human labels.

        Returns agreement rate and detailed comparison.
        """
        with open(eval_results_path) as f:
            results = [json.loads(line) for line in f if line.strip()]

        comparisons = []
        for result in results:
            task_id = result["task_id"]
            predicted = result["predicted_label"]
            task = self.tasks_by_id.get(task_id)

            if task:
                comparison = {
                    "task_id": task_id,
                    "task": task.description,
                    "predicted": predicted,
                    "human_labels": task.human_labels
                }
                comparisons.append(comparison)

        return {
            "total_evaluated": len(comparisons),
            "comparisons": comparisons
        }


# Convenience function for quick setup
def load_benchmark(output_dir: Optional[str] = None) -> Mind2WebBenchmark:
    """Load the Mind2Web benchmark with optional custom output directory."""
    return Mind2WebBenchmark(
        output_dir=Path(output_dir) if output_dir else None
    )
