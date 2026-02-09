"""Tests for TODOforAI Terminal-Bench adapter."""

from pathlib import Path


class TestTODOforAIAgent:
    def test_import(self):
        from todoforai_tbench import TODOforAIAgent
        assert TODOforAIAgent is not None

    def test_name(self):
        from todoforai_tbench import TODOforAIAgent
        assert TODOforAIAgent.name() == "todoforai"

    def test_install_script_exists(self):
        script = Path(__file__).parent.parent / "todoforai_tbench" / "scripts" / "install.sh"
        assert script.exists()
