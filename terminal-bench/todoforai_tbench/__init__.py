"""
TODOforAI Terminal-Bench Adapter

Provides agent implementations for running TODOforAI on Terminal-Bench.
"""

from .agent import TODOforAIAgent
from .installed_agent import TODOforAIInstalledAgent
from .direct_agent import TODOforAIDirectAgent
from .config import TBenchConfig, load_config

__all__ = [
    "TODOforAIAgent",
    "TODOforAIInstalledAgent",
    "TODOforAIDirectAgent",
    "TBenchConfig",
    "load_config",
]

__version__ = "0.1.0"
