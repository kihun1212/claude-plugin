import { spawnSync } from "node:child_process";

const TASK_TIMEOUT_MS = 10 * 60 * 1000; // safety net so a stuck copilot process never hangs the wrapper forever
const FAILURE_TEXT_RE = /\b(auth(entication)?|not\s+authenticated|please\s+run\s+.?copilot login|401|403|permission\s+denied|rate.?limit|429|quota\s+exceeded|billing)\b/i;

export function runCopilot(args, cwd) {
  const result = spawnSync("copilot", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: TASK_TIMEOUT_MS,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    status: result.status ?? (result.signal ? 124 : 1),
    signal: result.signal ?? null,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error ?? null,
    timedOut: Boolean(result.signal) && result.status == null,
  };
}

// Mirrors the failure heuristic this plugin replaces, verbatim:
// non-zero exit OR empty stdout on exit 0 OR auth/permission/rate-limit text.
export function classify(result) {
  if (result.error) {
    return { ok: false, code: "SPAWN_ERROR", reason: result.error.message };
  }
  if (result.timedOut) {
    return { ok: false, code: "TIMEOUT", reason: `copilot did not finish within ${TASK_TIMEOUT_MS}ms` };
  }
  const combined = `${result.stdout}\n${result.stderr}`;
  const failureMatch = combined.match(FAILURE_TEXT_RE);
  if (failureMatch) {
    return { ok: false, code: "AUTH_OR_RATE_LIMIT", reason: failureMatch[0] };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      code: "NON_ZERO_EXIT",
      reason: (result.stderr || result.stdout || `exit ${result.status}`).trim().slice(0, 4000),
    };
  }
  if (result.stdout.trim().length === 0) {
    return { ok: false, code: "EMPTY_OUTPUT", reason: "exit 0 but stdout was empty" };
  }
  return { ok: true };
}
