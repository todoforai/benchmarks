"""Tests for TODOforAI Harbor adapter."""

from pathlib import Path

import pytest


class TestTODOforAIHarborAgent:
    def test_import(self):
        from todoforai_tbench import TODOforAIHarborAgent
        assert TODOforAIHarborAgent is not None

    def test_name(self):
        from todoforai_tbench import TODOforAIHarborAgent
        assert TODOforAIHarborAgent.name() == "todoforai"

    def test_install_template_exists(self):
        template = Path(__file__).parent.parent / "todoforai_tbench" / "install-todoforai.sh.j2"
        assert template.exists()

    def test_raises_without_keys(self, monkeypatch, tmp_path):
        from todoforai_tbench.harbor_agent import TODOforAIHarborAgent
        # Reset class-level pool state
        TODOforAIHarborAgent._pool_initialized = False
        TODOforAIHarborAgent._key_pool = None
        monkeypatch.delenv("TODOFORAI_API_KEYS", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEY", raising=False)
        with pytest.raises(RuntimeError, match="No TODOforAI API keys configured"):
            TODOforAIHarborAgent(logs_dir=tmp_path)

    def test_initializes_with_keys(self, monkeypatch, tmp_path):
        from todoforai_tbench.harbor_agent import TODOforAIHarborAgent
        TODOforAIHarborAgent._pool_initialized = False
        TODOforAIHarborAgent._key_pool = None
        monkeypatch.setenv("TODOFORAI_API_KEY", "test-key")
        monkeypatch.delenv("TODOFORAI_API_KEYS", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        agent = TODOforAIHarborAgent(logs_dir=tmp_path)
        assert agent._key_pool is not None
        assert not agent._key_pool.empty()

    def test_create_run_agent_commands(self, monkeypatch, tmp_path):
        from todoforai_tbench.harbor_agent import TODOforAIHarborAgent
        TODOforAIHarborAgent._pool_initialized = False
        TODOforAIHarborAgent._key_pool = None
        monkeypatch.setenv("TODOFORAI_API_KEY", "test-key")
        monkeypatch.delenv("TODOFORAI_API_KEYS", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        monkeypatch.delenv("TODOFORAI_API_URL", raising=False)
        monkeypatch.delenv("TODOFORAI_PROJECT_ID", raising=False)
        agent = TODOforAIHarborAgent(logs_dir=tmp_path)
        commands = agent.create_run_agent_commands("do something")
        assert len(commands) == 1
        assert "todoai" in commands[0].command
        assert "todoforai-edge" in commands[0].command
        assert commands[0].timeout_sec == 660
