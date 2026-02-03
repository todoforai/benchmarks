"""
Tests for TODOforAI Terminal-Bench adapter.
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Import our modules
from todoforai_tbench.config import TBenchConfig, load_config


class TestConfig:
    """Test configuration management."""

    def test_default_config(self):
        """Test default configuration values."""
        config = TBenchConfig()

        assert config.default_model == "claude-sonnet-4-5"
        assert config.default_agent == "terminal"
        assert config.timeout == 600
        assert config.max_iterations == 100

    def test_config_from_dict(self):
        """Test creating config from dictionary."""
        data = {
            "api_url": "https://api.example.com",
            "api_key": "test-key",
            "default_model": "gpt-5",
            "timeout": 300,
        }

        config = TBenchConfig.from_dict(data)

        assert config.api_url == "https://api.example.com"
        assert config.api_key == "test-key"
        assert config.default_model == "gpt-5"
        assert config.timeout == 300

    def test_config_from_env(self, monkeypatch):
        """Test loading config from environment variables."""
        monkeypatch.setenv("TODOFORAI_API_URL", "https://env.example.com")
        monkeypatch.setenv("TODOFORAI_API_KEY", "env-key")

        config = TBenchConfig()

        assert config.api_url == "https://env.example.com"
        assert config.api_key == "env-key"

    def test_config_to_dict(self):
        """Test converting config to dictionary."""
        config = TBenchConfig(
            api_url="https://test.com",
            default_model="opus",
        )

        data = config.to_dict()

        assert data["api_url"] == "https://test.com"
        assert data["default_model"] == "opus"


class TestAgentImports:
    """Test that agent classes can be imported."""

    def test_import_base_agent(self):
        """Test importing TODOforAIAgent."""
        from todoforai_tbench import TODOforAIAgent
        assert TODOforAIAgent.name() == "todoforai"

    def test_import_installed_agent(self):
        """Test importing TODOforAIInstalledAgent."""
        from todoforai_tbench import TODOforAIInstalledAgent
        assert TODOforAIInstalledAgent.name() == "todoforai-installed"


class TestScripts:
    """Test that installation scripts exist."""

    def test_install_script_exists(self):
        """Test main install script exists."""
        script_path = Path(__file__).parent.parent / "todoforai_tbench" / "scripts" / "install.sh"
        assert script_path.exists()

    def test_minimal_script_exists(self):
        """Test minimal install script exists."""
        script_path = Path(__file__).parent.parent / "todoforai_tbench" / "scripts" / "install_minimal.sh"
        assert script_path.exists()


# Integration tests (require terminal-bench installed)
@pytest.mark.skipif(
    True,  # Skip by default
    reason="Integration tests require terminal-bench and API keys"
)
class TestIntegration:
    """Integration tests with real Terminal-Bench."""

    def test_run_hello_world(self):
        """Test running the hello-world task."""
        import subprocess

        result = subprocess.run(
            [
                "tb", "run",
                "--dataset", "terminal-bench-core==head",
                "--agent-import-path", "todoforai_tbench:TODOforAIAgent",
                "--task-id", "hello-world",
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        # Just check it ran without crashing
        assert result.returncode in [0, 1]  # Success or task failure both OK
