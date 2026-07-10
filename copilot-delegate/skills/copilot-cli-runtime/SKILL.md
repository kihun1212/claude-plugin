---
name: copilot-cli-runtime
description: Internal invocation contract for calling the copilot-companion runtime from Claude Code
user-invocable: false
---

# Copilot Runtime

Use this skill only inside the `copilot-delegate:copilot-forwarder` subagent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" task "<prompt>" [--write]`

Execution rules:
- Exactly one `task` call per forwarded request. The subagent is a forwarder, not an orchestrator — it must not investigate the repository itself.
- Do not call `setup` or `status` from this subagent; those are user-facing only.
- Model (`claude-opus-4.8`), context tier (`long_context`), retry-once, dirty-tree refusal, and the session failure circuit breaker are fixed inside the script. Never pass `--model`, `--context`, `--effort`, or any flag not listed above — the CLI rejects `--effort` for this model.
- Add `--write` only when the task needs edits, command execution, or test/build runs.
- If the Bash call fails or copilot cannot be invoked at all, return nothing.
