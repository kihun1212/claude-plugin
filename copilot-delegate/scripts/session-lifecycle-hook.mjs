#!/usr/bin/env node
import fs from "node:fs";
import process from "node:process";
import { removeSessionState } from "./state-helpers.mjs";

export const SESSION_ID_ENV = "COPILOT_DELEGATE_SESSION_ID";

function readHookInput() {
  try {
    const raw = fs.readFileSync(0, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function appendEnvVar(name, value) {
  if (!process.env.CLAUDE_ENV_FILE || value == null || value === "") return;
  fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export ${name}=${shellEscape(value)}\n`, "utf8");
}

function main() {
  const input = readHookInput();
  const eventName = process.argv[2] ?? input.hook_event_name ?? "";

  if (eventName === "SessionStart") {
    appendEnvVar(SESSION_ID_ENV, input.session_id);
    return;
  }

  if (eventName === "SessionEnd") {
    const sessionId = input.session_id || process.env[SESSION_ID_ENV];
    if (sessionId) removeSessionState(sessionId);
  }
}

main();
