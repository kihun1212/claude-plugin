---
description: Show this session's Copilot delegation failure-circuit state, and optionally reset it
argument-hint: '[--reset]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" status --json $ARGUMENTS`

Render this compactly: failure count, threshold, whether the circuit is open, and when it opened. If `--reset` was passed, confirm the circuit was cleared.
