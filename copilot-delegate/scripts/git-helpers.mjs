import { spawnSync } from "node:child_process";

export function checkWorkingTreeDirty(cwd) {
  const result = spawnSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8", shell: false });
  if (result.error || result.status !== 0) {
    // Not a git repo, or git missing — can't enforce the precondition, don't block.
    return { checked: false, dirty: false };
  }
  const status = result.stdout.trim();
  return { checked: true, dirty: status.length > 0, status };
}
