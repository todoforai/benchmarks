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

    def test_instantiates(self, tmp_path):
        from todoforai_tbench.harbor_agent import TODOforAIHarborAgent
        agent = TODOforAIHarborAgent(logs_dir=tmp_path)
        assert agent.name() == "todoforai"

    def test_has_install_method(self):
        from todoforai_tbench.harbor_agent import TODOforAIHarborAgent
        assert hasattr(TODOforAIHarborAgent, "install")
        import inspect
        assert inspect.iscoroutinefunction(TODOforAIHarborAgent.install)
