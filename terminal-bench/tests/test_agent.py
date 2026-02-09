"""Tests for TODOforAI Terminal-Bench adapter."""

import os
from pathlib import Path
from unittest.mock import patch

from todoforai_tbench.agent import _load_keys


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


class TestLoadKeys:
    def test_comma_separated_keys(self, monkeypatch):
        monkeypatch.setenv("TODOFORAI_API_KEYS", "key-1,key-2,key-3")
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEY", raising=False)
        assert _load_keys() == ["key-1", "key-2", "key-3"]

    def test_keys_file(self, tmp_path, monkeypatch):
        keys_file = tmp_path / "keys.txt"
        keys_file.write_text("key-a\nkey-b\n\nkey-c\n")
        monkeypatch.delenv("TODOFORAI_API_KEYS", raising=False)
        monkeypatch.setenv("TODOFORAI_API_KEYS_FILE", str(keys_file))
        monkeypatch.delenv("TODOFORAI_API_KEY", raising=False)
        assert _load_keys() == ["key-a", "key-b", "key-c"]

    def test_single_key_fallback(self, monkeypatch):
        monkeypatch.delenv("TODOFORAI_API_KEYS", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        monkeypatch.setenv("TODOFORAI_API_KEY", "single-key")
        assert _load_keys() == ["single-key"]

    def test_no_keys(self, monkeypatch):
        monkeypatch.delenv("TODOFORAI_API_KEYS", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEY", raising=False)
        assert _load_keys() == []

    def test_strips_whitespace(self, monkeypatch):
        monkeypatch.setenv("TODOFORAI_API_KEYS", " key-1 , key-2 ,, key-3 ")
        monkeypatch.delenv("TODOFORAI_API_KEYS_FILE", raising=False)
        monkeypatch.delenv("TODOFORAI_API_KEY", raising=False)
        assert _load_keys() == ["key-1", "key-2", "key-3"]
