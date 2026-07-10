#!/usr/bin/env node
import process from "node:process";
import { runCopilot, classify } from "./process-helpers.mjs";
import { checkWorkingTreeDirty } from "./git-helpers.mjs";
import {
  loadState,
  recordFailure,
  isCircuitOpen,
  resetState,
  CIRCUIT_BREAKER_THRESHOLD,
} from "./state-helpers.mjs";

// ---- Fixed policy constants (single source of truth) ----
// Verified against `copilot` CLI v1.0.69: "claude-opus-4-8" (hyphenated) errors as unavailable,
// "claude-opus-4.8" (dotted) works. If your account's model catalog differs, change this one line.
const COPILOT_MODEL = "claude-opus-4.8"; // ← change this
const COPILOT_CONTEXT_TIER = "long_context";
const RETRY_BACKOFF_MS = 2000;

function fail(code, message) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function emit(payload, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    return;
  }
  process.stdout.write(`${payload.message ?? JSON.stringify(payload)}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseFlags(argv) {
  const options = { write: false, json: false, verifyAuth: false, reset: false, sessionId: undefined };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") options.write = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--verify-auth") options.verifyAuth = true;
    else if (arg === "--reset") options.reset = true;
    else if (arg === "--session-id") {
      options.sessionId = argv[i + 1];
      i += 1;
    } else rest.push(arg);
  }
  return { options, rest };
}

function resolveSessionId(options) {
  return options.sessionId || process.env.COPILOT_DELEGATE_SESSION_ID || "manual";
}

function buildTaskArgs(prompt, write) {
  const args = [
    "-p",
    prompt,
    "--model",
    COPILOT_MODEL,
    "--context",
    COPILOT_CONTEXT_TIER,
    "--output-format",
    "text",
    "--silent",
  ];
  // Deliberately no --effort: the CLI rejects reasoning-effort flags for Claude models.
  if (write) args.push("--allow-all-tools");
  return args;
}

async function handleTask(argv) {
  const { options, rest } = parseFlags(argv);
  const prompt = rest.join(" ").trim();
  if (!prompt) {
    fail(1, "usage: task <prompt text> [--write] [--json] [--session-id <id>]");
    return;
  }

  const sessionId = resolveSessionId(options);
  const cwd = process.cwd();

  // 1) Circuit breaker check first — before anything else, including the dirty check.
  const state = loadState(sessionId);
  if (isCircuitOpen(state)) {
    emit(
      {
        ok: false,
        code: "CIRCUIT_OPEN",
        failures: state.failures,
        openedAt: state.openedAt,
        message:
          `Copilot delegation disabled for the rest of this session after ${state.failures} failed attempts. ` +
          `Handle this task locally. If Copilot is available again, run '/copilot-delegate:status --reset'.`,
      },
      options.json,
    );
    process.exit(3);
    return;
  }

  // 2) Dirty-tree precondition, write mode only.
  if (options.write) {
    const tree = checkWorkingTreeDirty(cwd);
    if (tree.checked && tree.dirty) {
      emit(
        {
          ok: false,
          code: "DIRTY_WORKING_TREE",
          message: "Working tree has uncommitted changes. Commit or stash before delegating a write/execute task, then retry.",
          status: tree.status,
        },
        options.json,
      );
      process.exit(4); // Refusal, not a delegation failure — does not touch the failure counter.
      return;
    }
  }

  // 3) Attempt #1, then exactly one retry on failure.
  const args = buildTaskArgs(prompt, options.write);
  let attempt = 1;
  let result = runCopilot(args, cwd);
  let verdict = classify(result);
  if (!verdict.ok) {
    await sleep(RETRY_BACKOFF_MS);
    attempt = 2;
    result = runCopilot(args, cwd);
    verdict = classify(result);
  }

  if (!verdict.ok) {
    const newState = recordFailure(sessionId, `${verdict.code}: ${verdict.reason}`);
    emit(
      {
        ok: false,
        code: "TASK_FAILED",
        attempts: attempt,
        reason: verdict.code,
        detail: verdict.reason,
        sessionFailures: newState.failures,
        circuitOpen: isCircuitOpen(newState),
      },
      options.json,
    );
    process.exit(2);
    return;
  }

  // Success — never touches the failure counter, even after a prior failure this session.
  if (options.json) {
    emit({ ok: true, attempts: attempt, content: result.stdout.trim() }, true);
  } else {
    process.stdout.write(result.stdout);
  }
  process.exit(0);
}

async function handleSetup(argv) {
  const { options } = parseFlags(argv);
  const versionResult = runCopilot(["--version"], process.cwd());
  const report = {
    binaryFound: !versionResult.error,
    version: versionResult.stdout.trim().split("\n")[0] || null,
  };

  if (!report.binaryFound) {
    emit(
      {
        ok: false,
        code: "CLI_NOT_FOUND",
        message:
          "The `copilot` CLI was not found on PATH. Install GitHub Copilot CLI for your platform, then run `copilot login`.",
        ...report,
      },
      options.json,
    );
    process.exit(1);
    return;
  }

  if (!options.verifyAuth) {
    emit(
      {
        ok: true,
        code: "READY_UNVERIFIED",
        message: `copilot CLI found (${report.version}). Run 'setup --verify-auth' to confirm auth and the configured model are working.`,
        ...report,
      },
      options.json,
    );
    process.exit(0);
    return;
  }

  const pingArgs = ["-p", "Reply with OK.", "--model", COPILOT_MODEL, "--output-format", "text", "--silent"];
  const pingResult = runCopilot(pingArgs, process.cwd());
  const pingVerdict = classify(pingResult);
  if (!pingVerdict.ok) {
    const modelUnavailable = /model.*(not available|unavailable)/i.test(`${pingResult.stdout}\n${pingResult.stderr}`);
    emit(
      {
        ok: false,
        code: modelUnavailable ? "MODEL_UNAVAILABLE" : "AUTH_CHECK_FAILED",
        message: modelUnavailable
          ? `Model "${COPILOT_MODEL}" is not available on this account. Edit COPILOT_MODEL in scripts/copilot-companion.mjs to a model your account's catalog supports.`
          : `Live auth check failed (${pingVerdict.code}): ${pingVerdict.reason}. Run 'copilot login'.`,
        detail: pingVerdict.reason,
        ...report,
      },
      options.json,
    );
    process.exit(1);
    return;
  }

  emit(
    {
      ok: true,
      code: "READY",
      message: `copilot CLI ready (${report.version}), authenticated, model "${COPILOT_MODEL}" responded.`,
      ...report,
    },
    options.json,
  );
  process.exit(0);
}

function handleStatus(argv) {
  const { options } = parseFlags(argv);
  const sessionId = resolveSessionId(options);
  if (options.reset) {
    resetState(sessionId);
  }
  const state = loadState(sessionId);
  emit(
    {
      sessionId,
      failures: state.failures,
      threshold: CIRCUIT_BREAKER_THRESHOLD,
      circuitOpen: isCircuitOpen(state),
      openedAt: state.openedAt,
      history: state.history,
      message: options.reset
        ? `Circuit reset for session "${sessionId}".`
        : `Session "${sessionId}": ${state.failures}/${CIRCUIT_BREAKER_THRESHOLD} failures${isCircuitOpen(state) ? " (circuit OPEN)" : ""}.`,
    },
    options.json,
  );
  process.exit(0);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "task":
      await handleTask(rest);
      break;
    case "setup":
      await handleSetup(rest);
      break;
    case "status":
      handleStatus(rest);
      break;
    default:
      fail(1, `unknown command "${command ?? ""}" — expected one of: task, setup, status`);
  }
}

main();
