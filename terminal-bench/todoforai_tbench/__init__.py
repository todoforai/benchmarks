"""
TODOforAI Terminal-Bench Adapter

Provides the TODOforAI agent for Terminal-Bench evaluation.
This agent connects to your TODOforAI backend to execute benchmark tasks.
"""

from .agent import TODOforAIAgent
from .installed_agent import TODOforAIInstalledAgent
from .config import TBenchConfig, load_config

__all__ = [
    "TODOforAIAgent",
    "TODOforAIInstalledAgent",
    "TBenchConfig",
    "load_config",
]

__version__ = "0.1.0"
