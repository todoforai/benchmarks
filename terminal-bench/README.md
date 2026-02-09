# TODOforAI Terminal-Bench Adapter

[Terminal-Bench](https://github.com/terminal-bench/terminal-bench) adapter for evaluating the TODOforAI agent.

## Installation

```bash
pip install todoforai-tbench
```

## Usage

```bash
tb run --dataset terminal-bench-core==0.1.1 \
  --agent-import-path todoforai_tbench:TODOforAIAgent \
  --task-id hello-world
```

## Configuration

| Environment Variable | Description |
|---------------------|-------------|
| `TODOFORAI_API_KEY` | API key for TODOforAI backend |
| `TODOFORAI_API_URL` | API URL (defaults to production) |
