// =============================================================================
// Git IPC handlers — thin routers over the resolved companion's VcsHost.
//
// The git logic itself lives in ONE place: the electron-free factory
// `createVcsCapability` (src/companion/capabilities/vcs.ts). Every companion
// (the local daemon and remote daemons) builds its vcs from that factory. The
// handlers below parse the locator off the cwd-like argument, resolve the target
// companion, and delegate to `companion.vcs.<op>` — they contain no git logic.
// =============================================================================

import { ipcMain } from 'electron'
import { parseLocator, formatLocator } from '../companion/locator'
import type { VcsHost } from '../companion/types'
import { resolveLocator } from '../companion/companionManager'
import { createVcsCapability } from '../../companion/capabilities/vcs'
import { getShellEnv } from '../shellEnv'
import {
  GIT_IS_REPO,
  GIT_INIT,
  GIT_LS_FILES,
  GIT_STATUS,
  GIT_DIFF,
  GIT_STAGE,
  GIT_UNSTAGE,
  GIT_COMMIT,
  GIT_WORKTREE_LIST,
  GIT_WORKTREE_ADD,
  GIT_WORKTREE_REMOVE,
  GIT_WORKTREE_PRUNE,
  GIT_WORKTREE_STATUS,
  GIT_WORKTREE_MERGE_TO,
  GIT_WORKTREE_ADD_FROM_PR,
  GIT_WORKTREE_UPDATE_FROM,
  GIT_CREATE_PR,
  GIT_PR_STATUS,
  GIT_PR_LIST,
  GIT_PUSH,
  GIT_PULL,
  GIT_FETCH,
  GIT_LOG,
  GIT_BRANCH_LIST,
  GIT_BRANCH_CREATE,
  GIT_BRANCH_DELETE,
  GIT_CHECKOUT,
  GIT_DIFF_STAGED,
  GIT_STASH,
  GIT_STASH_POP,
  GIT_DISCARD_FILE,
} from '../../shared/ipc-channels'

// The single vcs implementation, wired with the resolved login-shell env so
// git/gh see the full PATH — matching how every companion daemon builds it.
const localVcs = createVcsCapability({ env: getShellEnv })

/**
 * Create a local branch, optionally from an explicit start point. Thin
 * back-compat wrapper over the single vcs implementation (the logic lives in
 * `createVcsCapability().branchCreate`) — kept exported for the git tests.
 */
export async function createBranch(cwd: string, branchName: string, startPoint?: string): Promise<void> {
  return localVcs.branchCreate(cwd, branchName, startPoint)
}

// =============================================================================
// IPC handlers — thin routers: parse the locator off the cwd-like argument,
// resolve the target companion, delegate to its VcsHost.
// =============================================================================

/** Resolve the VcsHost for a cwd-bearing locator, returning it plus the decoded
 *  path and the companion id (needed to re-encode any path returned to the UI). */
function vcsFor(locator: string): { vcs: VcsHost; path: string; companionId: string } {
  const { companion, path, companionId } = resolveLocator(locator)
  return { vcs: companion.vcs, path, companionId }
}

/** Decode a worktree-path argument (a locator built by the renderer from the
 *  workspace root) into a companion-absolute path, asserting it targets the same
 *  companion as its repo. Without this the raw `cate-companion://…` URI reaches
 *  the daemon and `git worktree add` runs against a literal-scheme directory. */
export function worktreeTargetPath(repoCompanionId: string, targetLocator: string): string {
  const { companionId, path: p } = parseLocator(targetLocator)
  if (companionId !== repoCompanionId) {
    throw new Error('Worktree path must be on the same companion as its repository')
  }
  return p
}

/**
 * Register an exact pass-through git handler: parse the locator off the first
 * arg, resolve the companion's VcsHost, and delegate to `vcs[op](path, ...rest)`,
 * forwarding every trailing argument verbatim. `op` is constrained to a
 * `VcsHost` method name so a typo fails at compile time. Use only for handlers
 * whose body is exactly `const { vcs, path } = vcsFor(arg); return vcs.op(path, ...rest)`
 * — handlers that re-encode the locator (worktree add/remove/list) stay
 * hand-written below.
 */
function route<K extends keyof VcsHost>(channel: string, op: K): void {
  ipcMain.handle(channel, async (_event, locator: string, ...rest: unknown[]) => {
    const { vcs, path } = vcsFor(locator)
    // op is a VcsHost method; rest carries this channel's remaining args verbatim.
    return (vcs[op] as (...args: unknown[]) => unknown)(path, ...rest)
  })
}

export function registerHandlers(): void {
  // Exact pass-throughs: parse locator, delegate to vcs.<op>(path, ...rest).
  route(GIT_IS_REPO, 'isRepo')
  route(GIT_INIT, 'init')
  route(GIT_LS_FILES, 'lsFiles')
  route(GIT_STATUS, 'status')
  route(GIT_DIFF, 'diff')
  route(GIT_STAGE, 'stage')
  route(GIT_UNSTAGE, 'unstage')
  route(GIT_COMMIT, 'commit')
  route(GIT_PUSH, 'push')
  route(GIT_PULL, 'pull')
  route(GIT_FETCH, 'fetch')
  route(GIT_LOG, 'log')
  route(GIT_BRANCH_LIST, 'branchList')
  route(GIT_BRANCH_CREATE, 'branchCreate')
  route(GIT_BRANCH_DELETE, 'branchDelete')
  route(GIT_CHECKOUT, 'checkout')
  route(GIT_DIFF_STAGED, 'diffStaged')
  route(GIT_STASH, 'stash')
  route(GIT_STASH_POP, 'stashPop')
  route(GIT_DISCARD_FILE, 'discardFile')
  route(GIT_WORKTREE_PRUNE, 'worktreePrune')
  route(GIT_WORKTREE_STATUS, 'worktreeStatus')
  route(GIT_WORKTREE_MERGE_TO, 'worktreeMergeTo')
  route(GIT_WORKTREE_UPDATE_FROM, 'worktreeUpdateFrom')
  route(GIT_CREATE_PR, 'createPr')
  route(GIT_PR_STATUS, 'prStatus')
  route(GIT_PR_LIST, 'prList')

  // Hand-written: these re-encode/decode the locator (companionId + formatLocator
  // / worktreeTargetPath) and so are NOT exact pass-throughs.
  ipcMain.handle(GIT_WORKTREE_LIST, async (_event, cwd: string) => {
    const { vcs, path, companionId } = vcsFor(cwd)
    const worktrees = await vcs.worktreeList(path)
    return worktrees.map((w) => ({ ...w, path: formatLocator({ companionId, path: w.path }) }))
  })

  ipcMain.handle(
    GIT_WORKTREE_ADD,
    async (
      _event,
      repoCwd: string,
      branch: string,
      targetPath: string,
      options?: { createBranch?: boolean; baseRef?: string },
    ) => {
      const { vcs, path, companionId } = vcsFor(repoCwd)
      const target = worktreeTargetPath(companionId, targetPath)
      const res = await vcs.worktreeAdd(path, branch, target, options)
      return { ...res, path: formatLocator({ companionId, path: res.path }) }
    },
  )

  ipcMain.handle(
    GIT_WORKTREE_ADD_FROM_PR,
    async (_event, repoCwd: string, prNumber: number, targetPath: string) => {
      const { vcs, path, companionId } = vcsFor(repoCwd)
      const target = worktreeTargetPath(companionId, targetPath)
      const res = await vcs.worktreeAddFromPr(path, prNumber, target)
      return { ...res, path: formatLocator({ companionId, path: res.path }) }
    },
  )

  ipcMain.handle(
    GIT_WORKTREE_REMOVE,
    async (_event, repoCwd: string, worktreePath: string, options?: { force?: boolean }) => {
      const { vcs, path, companionId } = vcsFor(repoCwd)
      return vcs.worktreeRemove(path, worktreeTargetPath(companionId, worktreePath), options)
    },
  )
}
