import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE_VERSION = 1;
export const CIRCUIT_BREAKER_THRESHOLD = 2; // "2 or more failures" per the delegation rules this replaces
const PLUGIN_DATA_ENV = "CLAUDE_PLUGIN_DATA";
const FALLBACK_STATE_ROOT = path.join(os.tmpdir(), "copilot-delegate-companion");

function stateDir() {
  const root = process.env[PLUGIN_DATA_ENV]
    ? path.join(process.env[PLUGIN_DATA_ENV], "state")
    : FALLBACK_STATE_ROOT;
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function safeKey(sessionId) {
  const cleaned = String(sessionId || "manual").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 128);
  return cleaned || "manual";
}

function stateFile(sessionId) {
  return path.join(stateDir(), `${safeKey(sessionId)}.json`);
}

function defaultState() {
  return { version: STATE_VERSION, failures: 0, openedAt: null, history: [] };
}

export function loadState(sessionId) {
  const file = stateFile(sessionId);
  if (!fs.existsSync(file)) return defaultState();
  try {
    return { ...defaultState(), ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return defaultState();
  }
}

export function recordFailure(sessionId, reason) {
  const state = loadState(sessionId);
  state.failures += 1;
  state.history = [...(state.history ?? []), { at: new Date().toISOString(), reason }].slice(-10);
  if (state.failures >= CIRCUIT_BREAKER_THRESHOLD && !state.openedAt) {
    state.openedAt = new Date().toISOString();
  }
  fs.writeFileSync(stateFile(sessionId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return state;
}

export function isCircuitOpen(state) {
  return state.failures >= CIRCUIT_BREAKER_THRESHOLD;
}

export function resetState(sessionId) {
  const file = stateFile(sessionId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return defaultState();
}

export function removeSessionState(sessionId) {
  const file = stateFile(sessionId);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
