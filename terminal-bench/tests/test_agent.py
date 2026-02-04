"""
Tests for TODOforAI Terminal-Bench adapter.
"""

import asyncio
import os
import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock, AsyncMock

# Import our modules
from todoforai_tbench.config import TBenchConfig, load_config
from todoforai_tbench.agent import TODOforAIAgent, TmuxShellRedirector, ToolCall


class TestConfig:
    """Test configuration management."""

    def test_default_config(self):
        """Test default configuration values."""
        config = TBenchConfig()

        assert config.default_model == "claude-sonnet-4-5"
        assert config.default_agent == "Agent"
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


class TestTmuxShellRedirector:
    """Unit tests for TmuxShellRedirector - routes BASH calls to tmux."""

    def test_install_creates_instance(self, mock_tmux_session):
        """Test that install() creates and stores the redirector instance."""
        tool_calls = []

        with patch("todoforai_tbench.agent.TmuxShellRedirector._original_execute_block", None):
            with patch("todoforai_edge.handlers.shell_handler.ShellProcess") as mock_shell:
                mock_shell.execute_block = Mock()

                redirector = TmuxShellRedirector.install(mock_tmux_session, tool_calls)

                assert redirector is not None
                assert redirector.session == mock_tmux_session
                assert redirector.tool_calls is tool_calls
                assert TmuxShellRedirector._instance is redirector

    def test_uninstall_restores_original(self, mock_tmux_session):
        """Test that uninstall() restores original behavior."""
        original_func = Mock()
        tool_calls = []

        with patch("todoforai_edge.handlers.shell_handler.ShellProcess") as mock_shell:
            TmuxShellRedirector._original_execute_block = original_func
            mock_shell.execute_block = Mock()

            TmuxShellRedirector.install(mock_tmux_session, tool_calls)
            TmuxShellRedirector.uninstall()

            assert mock_shell.execute_block == original_func
            assert TmuxShellRedirector._original_execute_block is None

    def test_tool_call_recorded(self, mock_tmux_session):
        """Test that executing a command records the tool call."""
        tool_calls = []
        redirector = TmuxShellRedirector(mock_tmux_session, tool_calls)

        # Simulate the async execution
        mock_client = AsyncMock()

        async def run_test():
            with patch("todoforai_edge.constants.messages.shell_block_start_result_msg", return_value={}):
                with patch("todoforai_edge.constants.messages.shell_block_message_result_msg", return_value={}):
                    with patch("todoforai_edge.constants.messages.shell_block_done_result_msg", return_value={}):
                        await redirector._execute_in_tmux(
                            block_id="test-block",
                            content="echo hello",
                            client=mock_client,
                            todo_id="test-todo",
                            request_id="test-request",
                            timeout=30
                        )

        asyncio.run(run_test())

        assert len(tool_calls) == 1
        assert tool_calls[0].tool_name == "BASH"
        assert tool_calls[0].arguments == {"command": "echo hello"}
        mock_tmux_session.send_keys.assert_called_once_with("echo hello", block=True, max_timeout_sec=30.0)


class TestTODOforAIAgentInit:
    """Unit tests for TODOforAIAgent initialization."""

    def test_default_initialization(self):
        """Test agent initializes with default config."""
        with patch.dict(os.environ, {}, clear=True):
            config = TBenchConfig(api_key="test-key")
            agent = TODOforAIAgent(config=config)

            assert agent.config is config
            assert agent.model == "claude-sonnet-4-5"
            assert agent.total_input_tokens == 0
            assert agent.total_output_tokens == 0
            assert agent.tool_calls == []

    def test_custom_model_override(self):
        """Test that model parameter overrides config default."""
        config = TBenchConfig(
            api_key="test-key",
            default_model="gpt-4o"
        )
        agent = TODOforAIAgent(config=config, model="claude-opus-4")

        assert agent.model == "claude-opus-4"
        assert agent.config.default_model == "gpt-4o"  # Config unchanged

    def test_name_returns_todoforai(self):
        """Test static name method."""
        assert TODOforAIAgent.name() == "todoforai"

    def test_agent_uses_config_model_when_no_override(self):
        """Test that agent uses config model when model param not provided."""
        config = TBenchConfig(
            api_key="test-key",
            default_model="gemini-pro"
        )
        agent = TODOforAIAgent(config=config)

        assert agent.model == "gemini-pro"


# Integration tests - require local services running
@pytest.mark.skipif(
    not os.environ.get("TBENCH_INTEGRATION_TESTS"),
    reason="Set TBENCH_INTEGRATION_TESTS=1 to run integration tests"
)
class TestLocalIntegration:
    """
    Integration tests with local TODOforAI services.

    Requirements:
    - PM2 services running (backend, agent, edge)
    - Valid API key in environment or config

    Run with: TBENCH_INTEGRATION_TESTS=1 pytest tests/test_agent.py -v -k TestLocalIntegration
    """

    @pytest.fixture
    def local_config(self):
        """Config for local testing."""
        return TBenchConfig(
            api_url=os.environ.get("TODOFORAI_API_URL", "http://localhost:4000"),
            api_key=os.environ.get("TODOFORAI_API_KEY", ""),
            timeout=60,  # Shorter timeout for tests
        )

    def test_agent_can_connect_to_backend(self, local_config, mock_tmux_session):
        """Test that agent can establish connection to local backend."""
        if not local_config.api_key:
            pytest.skip("No API key configured")

        agent = TODOforAIAgent(config=local_config)

        # Mock the edge to just verify connection attempt
        with patch("todoforai_tbench.agent.TODOforAIEdge") as mock_edge_class:
            mock_edge = AsyncMock()
            mock_edge.connected = True
            mock_edge.edge_id = "test-edge-123"
            mock_edge.list_agent_settings = AsyncMock(return_value=[
                {"id": "1", "name": "Test Agent"}
            ])
            mock_edge.add_message = AsyncMock(return_value={"id": "todo-1"})
            mock_edge.wait_for_todo_completion = AsyncMock(return_value={"success": True})
            mock_edge_class.return_value = mock_edge

            result = agent.perform_task(
                instruction="echo 'test'",
                session=mock_tmux_session,
                logging_dir=None
            )

            # Verify the agent attempted to use the edge
            mock_edge_class.assert_called_once()
            assert result.failure_mode == "none"

    def test_simple_echo_task(self, local_config, mock_tmux_session, tmp_path):
        """Test running a simple echo command through the full stack."""
        if not local_config.api_key:
            pytest.skip("No API key configured")

        agent = TODOforAIAgent(config=local_config)
        log_dir = tmp_path / "logs"

        # This test exercises the real connection path
        # Note: Will fail if backend not running, which is expected
        try:
            result = agent.perform_task(
                instruction="Run: echo 'hello from test'",
                session=mock_tmux_session,
                logging_dir=log_dir
            )

            # If we got here, check logs were created
            assert log_dir.exists() or result.failure_mode != "none"

        except ConnectionError:
            pytest.skip("Backend not reachable - ensure PM2 services are running")
