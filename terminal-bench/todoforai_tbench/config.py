"""
Configuration management for TODOforAI Terminal-Bench adapter.
"""

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Dict, Any


@dataclass
class TBenchConfig:
    """Configuration for Terminal-Bench adapter."""

    # TODOforAI connection
    api_url: str = "http://localhost:4000"
    api_key: str = ""

    # Agent settings
    default_model: str = "claude-sonnet-4-5"
    default_agent: str = "Agent"
    project_id: Optional[str] = None

    # Execution settings
    timeout: int = 600  # 10 minutes per task
    max_iterations: int = 100

    # Logging
    log_dir: str = "./logs"
    verbose: bool = False

    # Token tracking
    track_tokens: bool = True

    # Extra settings
    extra: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        # Load from environment if not set
        if not self.api_url or self.api_url == "http://localhost:4000":
            self.api_url = os.environ.get("TODOFORAI_API_URL") or os.environ.get("TODO4AI_API_URL") or "http://localhost:4000"
        if not self.api_key:
            self.api_key = os.environ.get("TODOFORAI_API_KEY") or os.environ.get("TODO4AI_API_KEY") or ""
        if not self.project_id:
            self.project_id = os.environ.get("TODOFORAI_PROJECT_ID") or os.environ.get("TODO4AI_PROJECT_ID")

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TBenchConfig":
        """Create config from dictionary."""
        known_fields = {
            "api_url", "api_key", "default_model", "default_agent",
            "project_id", "timeout", "max_iterations", "log_dir",
            "verbose", "track_tokens"
        }

        kwargs = {k: v for k, v in data.items() if k in known_fields}
        extra = {k: v for k, v in data.items() if k not in known_fields}

        config = cls(**kwargs)
        config.extra = extra
        return config

    @classmethod
    def from_file(cls, path: Path) -> "TBenchConfig":
        """Load config from JSON file."""
        with open(path) as f:
            data = json.load(f)
        return cls.from_dict(data)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "api_url": self.api_url,
            "api_key": self.api_key,
            "default_model": self.default_model,
            "default_agent": self.default_agent,
            "project_id": self.project_id,
            "timeout": self.timeout,
            "max_iterations": self.max_iterations,
            "log_dir": self.log_dir,
            "verbose": self.verbose,
            "track_tokens": self.track_tokens,
            **self.extra
        }

    def save(self, path: Path) -> None:
        """Save config to JSON file."""
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(self.to_dict(), f, indent=2)


def load_config(config_path: Optional[Path] = None) -> TBenchConfig:
    """
    Load configuration from file or defaults.

    Search order:
    1. Explicit config_path
    2. ./tbench.json
    3. ~/.todoforai/tbench.json
    4. Environment variables only
    """
    search_paths = []

    if config_path:
        search_paths.append(Path(config_path))

    search_paths.extend([
        Path("./tbench.json"),
        Path("~/.todoforai/tbench.json").expanduser(),
    ])

    for path in search_paths:
        if path.exists():
            return TBenchConfig.from_file(path)

    # Return default config (uses env vars)
    return TBenchConfig()


def get_anthropic_key() -> Optional[str]:
    """Get Anthropic API key from environment."""
    return os.environ.get("ANTHROPIC_API_KEY")


def get_openai_key() -> Optional[str]:
    """Get OpenAI API key from environment."""
    return os.environ.get("OPENAI_API_KEY")
