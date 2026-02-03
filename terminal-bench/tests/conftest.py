"""
Pytest configuration for TODOforAI Terminal-Bench tests.
"""

import os
import sys
from pathlib import Path

import pytest

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def mock_tmux_session():
    """Create a mock TmuxSession for testing."""
    from unittest.mock import Mock

    session = Mock()
    session.session_id = "test-session"
    session.is_busy.return_value = False
    session.get_output.return_value = "mock output"

    return session


@pytest.fixture
def temp_config(tmp_path):
    """Create a temporary config file."""
    config_path = tmp_path / "tbench.json"
    config_path.write_text('''{
        "api_url": "https://test.api.com",
        "api_key": "test-key-123",
        "default_model": "claude-sonnet-4-5",
        "timeout": 300
    }''')

    return config_path


