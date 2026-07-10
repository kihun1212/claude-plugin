# copilot-delegate

Delegate heavy-context, light-judgment work to the [GitHub Copilot CLI](https://github.com/github/copilot-cli), recovering only a compact result. <br>
Installing this plugin lets you drop the "Copilot Delegation Rules" section from `CLAUDE.md` — the agent triggers proactively on the right kind of task, and a companion script enforces retry-once, dirty-tree, and session failure-circuit-breaker rules in code instead of prose you'd otherwise have to remember to follow every time.

## What it does

| Component | Purpose |
| --- | --- |
| `copilot-forwarder` (agent) | Forwards exploration/boilerplate/refactor/verification tasks to `copilot`, restricted to `Bash` only so it never investigates the repo itself. Token-isolated. |
| `copilot-cli-runtime` (skill) | Invocation contract used by the forwarder — exactly one call, no ad-hoc flags. |
| `copilot-result-handling` (skill) | Governs how the main thread presents results and handles each failure mode. |
| `/copilot-delegate:setup` | Check the `copilot` CLI is installed, authenticated, and the configured model responds. |
| `/copilot-delegate:status` | Show or reset this session's delegation failure count. |
| `/copilot-delegate:delegate` | Explicitly delegate a task, instead of waiting for proactive auto-trigger. |

All the mechanical rules — exact CLI flags, retry-once on failure, refusing write-mode delegation against a dirty working tree, and disabling delegation for the rest of a session after 2 cumulative failures — live in `scripts/copilot-companion.mjs`, not in prose.

## Requirements

- **GitHub Copilot CLI** installed and authenticated: `copilot login`.
- **Node.js** on `PATH` (used to run the companion script — no other dependencies).

## Configuration

### Model

The only plugin-side setting is the **model slug**, in `scripts/copilot-companion.mjs`:

```js
const COPILOT_MODEL = "claude-opus-4.8"; // ← change this
```

Verified against `copilot` CLI v1.0.69: `claude-opus-4-8` (hyphenated) errors as unavailable, `claude-opus-4.8` (dotted) works. Model catalogs vary by account — run `/copilot-delegate:setup --verify-auth` after installing to confirm the configured model actually responds on your account, and edit this one line if it doesn't.

## Usage

```
/copilot-delegate:setup --verify-auth
/copilot-delegate:delegate find every place the retry helper is used across this codebase
/copilot-delegate:delegate --write add unit tests for the new parser module
/copilot-delegate:status
```

Or just ask naturally — the `copilot-forwarder` agent triggers automatically on multi-file exploration, boilerplate/test code, mechanical refactors, and test/build verification. Design, API/interface design, and security-sensitive code are deliberately excluded and stay with the main thread.

### Failure handling

- A failed delegation is retried once automatically.
- If still failing, the main thread is told in one line and continues the task locally.
- After 2 cumulative failures in a session, delegation is disabled for the rest of that session (enforced by a session-scoped state file, reset on `SessionEnd`). Run `/copilot-delegate:status --reset` once Copilot is available again to re-enable it mid-session.
- Write-mode delegation refuses to run against a dirty working tree rather than auto-committing on your behalf — commit or stash first.
