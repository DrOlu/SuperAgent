# Storage Revamp Plan

Status: active rollout, phases 1 and 2 complete

This document now tracks the storage revamp as it exists today, not as a speculative design exercise.
The DB foundation and the project/workspace identity cutover have landed. What remains is the explicit
creation/archive surface cleanup, timeline durability cutover, and final removal of legacy paths.

## Goals

- make structured records durable in Drizzle + SQLite
- make projects and workspaces explicit first-class records
- stop deriving project/workspace identity from agent `cwd`
- keep agent snapshot persistence behind clear ownership
- move committed timeline history to storage-owned rows
- remove legacy JSON and in-memory authority once the DB path is proven

## Out of scope

- moving config, keypairs, push tokens, or server identity into the DB
- persisting raw provider deltas or transport-only chunk streams
- designing a hosted/remote database story beyond keeping the schema portable
- durable reasoning history unless product explicitly asks for it later

## Current state

The storage revamp is no longer hypothetical.

Completed:

- Drizzle + SQLite database bootstrap is in place
- `projects`, `workspaces`, and `agent_snapshots` use integer primary keys
- `workspaces.project_id` and `agent_snapshots.workspace_id` cascade on delete
- `agent_snapshots.workspace_id` is `NOT NULL`
- legacy JSON import feeds the DB-backed structured records
- project/workspace records use explicit `directory` fields instead of path-as-identity
- session read paths now use persisted workspace/project rows instead of cwd/git derivation
- `workspace-reconciliation-service.ts` is deleted
- `workspace-registry-bootstrap.ts` is deleted
- `workspace-registry-model.ts` is reduced to `normalizeWorkspaceId`

Still pending:

- explicit `create_project` / `create_workspace` API cleanup
- final archive cascade behavior for descendants and live agents
- committed timeline storage cutover
- removal of remaining legacy JSON and in-memory committed-history authority

## Converged decisions

### Structured record authority

Projects, workspaces, and agent snapshots are DB-backed structured records.
The server should not recreate project/workspace identity from:

- git remotes
- worktree main-repo roots
- normalized cwd strings

Temporary exception:

- agent creation may still find-or-create a workspace by directory if the UI has not yet provided
  `workspaceId` explicitly

That fallback is transitional and should be deleted once the client always sends the workspace id.

### Storage seams

The useful seams remain concrete and domain-shaped:

- `ProjectRegistry`
- `WorkspaceRegistry`
- `AgentSnapshotStore`
- `AgentTimelineStore`

There is no reason to reintroduce a reconciliation service layer for project/workspace identity.

### Timeline contract

The long-term timeline contract remains:

- committed rows are durable, canonical history
- provisional live updates are transient subscription state
- committed history is fetched by seq
- provider history replay is not the durability mechanism

The structured-record cutover is complete before the timeline cutover so timeline rows can rely on
stable DB-backed agent and workspace identity.

## Remaining phases

### Phase 3: Explicit creation and archive cleanup

Goal:
Remove the last transitional write paths that still infer state from directories.

Required work:

- add explicit `create_project` handling
- add explicit `create_workspace` handling
- make agent creation require `workspaceId` once the UI is ready
- finish archive semantics for workspaces/projects and any descendant agent state
- remove the temporary find-or-create-by-directory fallback from agent creation

Exit gate:

- project/workspace creation is explicit end to end
- no normal creation path infers identity from cwd or git metadata
- archive flows behave consistently for structured records and live runtime state

### Phase 4: Timeline storage cutover

Goal:
Make committed history durable and storage-owned.

Required work:

- make `AgentTimelineStore` authoritative for committed history
- write one committed row per finalized logical item
- support tail, before-seq, and after-seq queries from storage
- stop treating provider history hydration as the normal refresh/load path
- keep provisional live updates in memory only

Exit gate:

- committed history survives daemon restart
- reconnect uses committed catch-up plus future live events without gaps or duplicates
- unloaded agents can serve committed history from storage alone

### Phase 5: Legacy cleanup

Goal:
Remove compatibility paths after the DB-backed model is fully authoritative.

Required work:

- remove legacy JSON authority for structured records
- remove in-memory committed-history ownership
- remove provider-history rehydrate compatibility paths
- trim dead protocol and reducer logic from the pre-storage model
- update architecture docs to match the final model

Exit gate:

- there is one durable storage path for structured records
- there is one durable storage path for committed timeline history
- the runtime no longer depends on the removed JSON/in-memory model

## Data model summary

### Projects

- integer primary key
- `directory` is unique
- `display_name`
- `kind`: `git | directory`
- optional `git_remote`
- timestamps and archive state

### Workspaces

- integer primary key
- belongs to a project by `project_id`
- `directory` is unique
- `display_name`
- `kind`: `checkout | worktree`
- timestamps and archive state

### Agent snapshots

- `agent_id` remains the primary key
- belongs to a workspace by integer `workspace_id`
- `workspace_id` is required
- timestamps, lifecycle state, persistence metadata, attention metadata, archive state

### Timeline rows

Target shape once Phase 4 lands:

- `agent_id`
- committed `seq`
- committed timestamp
- canonical finalized item payload

Not part of durable history:

- raw streaming chunks
- provisional assistant text
- provisional reasoning text

## Verification requirements

Every remaining phase should keep the same bar:

- `npm run typecheck`
- targeted tests for the touched storage/session/runtime paths
- migration/import coverage when storage authority changes
- reconnect and catch-up scenario coverage when timeline behavior changes

At minimum, timeline cutover must explicitly prove:

- `fetch-after-seq`
- `fetch-before-seq`
- restart durability
- no-gap/no-duplicate reconnect behavior

## Main risks

- timeline work reintroduces provider-history replay as hidden authority
- archive behavior diverges between stored records and live in-memory agents
- explicit creation work leaves the transitional cwd fallback in place too long
- cleanup stalls after compatibility paths stop being exercised

## Rule of thumb

If a new change needs to ask "what can we infer from this cwd?" for project or workspace identity,
it is probably moving in the wrong direction.
