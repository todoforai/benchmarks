# airbench.ai v1.0 — rerun after compaction fix (EasyContext 9be91cf)
Checkup: https://airbench.ai/checkup/1db808e6-663e-427d-b44b-9450e29bf36f/report
Todo: db3c1d39-7706-4f7e-99b0-493f58d50374 · deepinfra:qwen/qwen3.8-27b · CLI --isolated · 942 s · exit 0 (todo READY)

**Final: 51% — 25/49 passed, 7 failed, 17 unanswered (partial)**

| Section | Run 1 (pre-fix) | Run 2 (this) |
|---|---|---|
| Math | 9/9 | 7/9 (letter-count, math-expression wrong) |
| Vision | 16/19 | 14/19 (count-medium/complex, spatial-complex, chart-medium/complex wrong) |
| Email | 0/6 | 4/6 (needle-1/2 unanswered) |
| Purchasing | 0/4 | 0/4 not attempted |
| Coding | 0/11 | 0/11 not attempted |

End: no context overflow and no compaction this time (250 messages). Final assistant turn emitted its tool call inside the reasoning channel (`<|im_start|>cmd> … </tool_call>`), so no tool call was parsed and the turn ended as complete → todo READY. No debrief sent. The compaction fix was not exercised.
