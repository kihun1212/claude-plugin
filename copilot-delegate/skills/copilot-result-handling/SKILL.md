---
name: copilot-result-handling
description: Presents output from the copilot-delegate forwarder agent or copilot-companion.mjs back to the user, and decides whether a delegation actually succeeded. Use immediately after copilot-forwarder (or a direct setup/status call) returns output.
user-invocable: false
---

# Copilot Result Handling

When the companion script returns:

- Preserve its structure and content verbatim. Do not re-read the original files in full — look only at the diff, the changed-files list, or the specific section the summary points to.
- Success (exit 0): present the compact result as-is.
- `DIRTY_WORKING_TREE` (exit 4): tell the user a write/refactor delegation needs a clean working tree first — commit or stash, then retry. Do not auto-commit on the user's behalf.
- `CIRCUIT_OPEN` (exit 3): tell the user Copilot delegation is disabled for the rest of this session after repeated failures, and that you are continuing locally. Do not retry and do not re-delegate any subtask until the user explicitly says Copilot is available again — at that point, run `/copilot-delegate:status --reset`.
- `TASK_FAILED` (exit 2, after the script's own single retry): notify the user in one line of the failure and its cause, then continue the task yourself, locally, conserving tokens (narrow reads, small units, incremental verification). Do not re-delegate this subtask again.
- Hard stop: never turn a failed or refused delegation into a silent Claude-side reattempt without surfacing the one-line failure notice first.
- If Copilot was never actually invoked (script usage error, missing binary), do not generate a substitute answer framed as if Copilot produced it — report the failure and direct the user to `/copilot-delegate:setup`.
