"""
Mind2Web Benchmark Adapter

Provides an interface to run agents against the Online-Mind2Web benchmark.
"""

from .mind2web_adapter import (
    Mind2WebBenchmark,
    TaskRunner,
    Task,
    Action,
    load_benchmark
)

__all__ = [
    "Mind2WebBenchmark",
    "TaskRunner",
    "Task",
    "Action",
    "load_benchmark"
]
