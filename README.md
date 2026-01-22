# TodoForAI Benchmarks

Benchmarks for evaluating TodoForAI browsing agents and comparing with state-of-the-art web agents.

## Structure

```
benchmarks/
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

## Results

Our benchmark results will be stored in the `results/` directory with timestamps and configuration details.

## Related Projects

- [browser-use-benchmark](../browser-use-benchmark) - Human web automation competition platform
- [browsing](../browsing) - TodoForAI browsing server

## License

- Online-Mind2Web dataset: CC-BY-4.0
- Online-Mind2Web code: MIT
- Our additions: MIT
