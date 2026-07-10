---
description: Check whether the local GitHub Copilot CLI is installed and ready for delegation
argument-hint: '[--verify-auth]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" setup --json $ARGUMENTS
```

Present the result. If it reports the CLI missing, tell the user how to install GitHub Copilot CLI for their platform. If it reports the model is unavailable, tell the user the hardcoded model slug in `scripts/copilot-companion.mjs` (`COPILOT_MODEL`) needs to be updated to match their account's catalog, and point at that one line. If not authenticated, tell them to run `!copilot login`.
