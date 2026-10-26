# airbench.ai v1.0 — TODOforAI isolated, deepinfra:qwen/qwen3.8-27b
Checkup: https://airbench.ai/checkup/da1b4297-f8fe-444a-974f-e24d16adc9aa/report
Todo: 8f42763a-7838-4b7e-ae73-560cfb10125e · elapsed 3920 s · exit 1 (todo ERROR)

**Final: 51% — 25/49 passed, 2 failed, 22 unanswered (partial run)**

| Section | Result |
|---|---|
| Math | 9/9 |
| Vision | 16/19 (spatial-complex, chart-medium failed; diagram-complex unanswered) |
| Email | 0/6 not attempted |
| Purchasing | 0/4 not attempted |
| Coding | 0/11 not attempted |

Last accepted submit at 9m48s. Then ~60 min of pixel-tracing on diagram-complex with no answer.
End: context overflow — after compaction, prompt ≥196609 + requested 65536 output > 262144 model limit → todo ERROR. No debrief POST sent.
Infra notes: urllib 403 on airbench.ai (agent switched to curl); Pillow missing (agent pip-installed). Token usage not exposed in messages.json.
