---
description: Explicitly delegate a task to Copilot via the copilot-forwarder subagent
argument-hint: '[--write] <what Copilot should explore, write, refactor, or verify>'
allowed-tools: Agent
---

Invoke the `copilot-delegate:copilot-forwarder` subagent via the `Agent` tool, forwarding the raw request as the prompt. The final user-visible response must be the forwarder's output verbatim (governed by `copilot-result-handling`, which will auto-trigger on the returned output).

Raw request:
$ARGUMENTS
