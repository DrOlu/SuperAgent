import { resolve } from "node:path";

export type PersistedProjectKind = "git" | "directory";
export type PersistedWorkspaceKind = "checkout" | "worktree";

export function normalizeWorkspaceId(cwd: string): string {
  const trimmed = cwd.trim();
  if (!trimmed) {
    return cwd;
  }
  return resolve(trimmed);
}
