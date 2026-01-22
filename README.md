# TodoForAI Benchmarks

Benchmarks for evaluating TodoForAI browsing agents and comparing with state-of-the-art web agents.

## Structure

```
benchmarks/
├── adapter/             # TodoForAI adapter for running benchmarks
│   ├── mind2web_adapter.py  # Core library
│   ├── cli.py               # CLI for managing tasks
│   └── run_benchmark.py     # Runner for todoai_cli
├── online-mind2web/     # Online-Mind2Web benchmark (OSU-NLP-Group)
├── common/              # Shared evaluation utilities
│   ├── metrics/         # Common metrics calculations
│   └── reporting/       # Report generation tools
└── results/             # Our system's benchmark results
```

## Benchmarks

### Online-Mind2Web

A benchmark for evaluating web agents on **live websites** with 300 tasks across 136 websites.

- **Source**: [OSU-NLP-Group/Online-Mind2Web](https://github.com/OSU-NLP-Group/Online-Mind2Web)
- **Paper**: [arXiv:2504.01382](https://arxiv.org/abs/2504.01382)
- **Leaderboard**: [HuggingFace Space](https://huggingface.co/spaces/osunlp/Online_Mind2Web_Leaderboard)

**Key Features:**
- 300 diverse tasks across 136 real websites
- WebJudge evaluation (85.7% agreement with humans)
- Domains: shopping, reservations, financial, information lookup

**Setup:**
```bash
cd online-mind2web
conda create -n Online_Mind2Web python=3.11
conda activate Online_Mind2Web
pip install -r requirements.txt

# Download data from original repository (not included due to size ~5.4GB)
# Option 1: Clone data from original repo
git clone --depth 1 --filter=blob:none --sparse https://github.com/OSU-NLP-Group/Online-Mind2Web.git temp_data
cd temp_data && git sparse-checkout set data && cd ..
mv temp_data/data . && rm -rf temp_data

# Option 2: Download from HuggingFace datasets
# See: https://huggingface.co/datasets/osunlp/Online-Mind2Web
```

**Running the benchmark:**
```bash
bash ./script/eval.sh
```

## TodoForAI Adapter

The `adapter/` folder contains our integration for running TodoForAI agents against the benchmark.

### Quick Start

```python
from adapter import Mind2WebBenchmark, TaskRunner

# Load benchmark (300 tasks)
benchmark = Mind2WebBenchmark()

# Run your agent on each task
for task in benchmark.tasks:
    runner = benchmark.create_runner(task)

    # Your agent loop
    runner.screenshot(browser.screenshot())  # Initial state

    while not done:
        thought = your_agent.think(state)
        runner.add_thought(thought)

        action = your_agent.act(thought)
        runner.add_action(action)

        browser.execute(action)
        runner.screenshot(browser.screenshot())

    runner.complete(status="success", final_response="Task completed...")

# Run WebJudge evaluation
benchmark.evaluate(model="gpt-4o-mini")
```

### CLI Commands

```bash
# List tasks
python adapter/cli.py list

# Show task details
python adapter/cli.py show TASK_ID

# Check completion status
python adapter/cli.py status

# Run evaluation
python adapter/cli.py eval --api-key YOUR_KEY

# Export tasks
python adapter/cli.py export --format json
```

### Run with todoai_cli

```bash
# Run all tasks
python adapter/run_benchmark.py

# Run first 5 tasks
python adapter/run_benchmark.py --limit 5 -y

# Resume incomplete tasks
python adapter/run_benchmark.py --resume
```

## Results

Our benchmark results will be stored in the `results/` directory with timestamps and configuration details.

## Related Projects

- [browser-use-benchmark](../browser-use-benchmark) - Human web automation competition platform
- [browsing](../browsing) - TodoForAI browsing server

## License

- Online-Mind2Web dataset: CC-BY-4.0
- Online-Mind2Web code: MIT
- Our additions: MIT
