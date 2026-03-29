# Terminal Mode — Implementation Plan

## Concept

Terminal mode wraps an agent TUI (Claude Code, Codex, OpenCode, Gemini, etc.) in a Paseo agent entity. The agent is tracked in sessions, has a provider/icon/title, and can be archived — but instead of rendering a structured chat view, it renders a terminal running the agent's CLI.

**Key principle:** `agent.terminal` is a boolean flag on the agent entity. If `true`, the panel renders a terminal. If `false` (default), it renders the current structured AgentStreamView.

## What Changes

### Phase 1: Server — Data Model & Provider Interface

#### 1.1 Add `terminal` flag to `ManagedAgentBase`

**File:** `packages/server/src/server/agent/agent-manager.ts`

```typescript
type ManagedAgentBase = {
  // ...existing fields...
  terminal: boolean;  // NEW — if true, this agent renders as a terminal TUI
};
```

This flag is set at creation time and never changes. A terminal agent is always a terminal agent.

#### 1.2 Add `terminal` to `AgentSessionConfig`

**File:** `packages/server/src/server/agent/agent-sdk-types.ts`

```typescript
export type AgentSessionConfig = {
  // ...existing fields...
  terminal?: boolean;  // NEW — create as terminal agent
};
```

#### 1.3 Add `terminal` to the Zod schema

**File:** `packages/server/src/shared/messages.ts`

Add to `AgentSessionConfigSchema`:
```typescript
terminal: z.boolean().optional(),
```

Add to the `AgentStateSchema` (the wire format sent to clients):
```typescript
terminal: z.boolean().optional(),
```

#### 1.4 Add terminal command builders to `AgentClient`

**File:** `packages/server/src/server/agent/agent-sdk-types.ts`

```typescript
export type TerminalCommand = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export interface AgentClient {
  // ...existing methods...

  /**
   * Build the shell command to launch this agent's TUI for a new session.
   * Only available if capabilities.supportsTerminalMode is true.
   */
  buildTerminalCreateCommand?(config: AgentSessionConfig): TerminalCommand;

  /**
   * Build the shell command to resume an existing session in the agent's TUI.
   * Only available if capabilities.supportsTerminalMode is true.
   */
  buildTerminalResumeCommand?(handle: AgentPersistenceHandle): TerminalCommand;
}
```

#### 1.5 Add `supportsTerminalMode` capability

**File:** `packages/server/src/server/agent/agent-sdk-types.ts`

```typescript
export type AgentCapabilityFlags = {
  // ...existing flags...
  supportsTerminalMode: boolean;  // NEW
};
```

Also add to the Zod schema in `messages.ts`:
```typescript
supportsTerminalMode: z.boolean(),
```

#### 1.6 Implement terminal command builders in providers

**Claude** (`packages/server/src/server/agent/providers/claude-agent.ts`):
```typescript
buildTerminalCreateCommand(config: AgentSessionConfig): TerminalCommand {
  const args: string[] = [];
  if (config.modeId === "bypassPermissions") {
    args.push("--dangerously-skip-permissions");
  }
  if (config.model) args.push("--model", config.model);
  // mode mapping: default → nothing, plan → --plan, etc.
  return { command: "claude", args, env: {} };
}

buildTerminalResumeCommand(handle: AgentPersistenceHandle): TerminalCommand {
  return {
    command: "claude",
    args: ["--resume", handle.sessionId],
    env: {},
  };
}
```

**Codex** (`packages/server/src/server/agent/providers/codex-app-server-agent.ts`):
```typescript
buildTerminalCreateCommand(config: AgentSessionConfig): TerminalCommand {
  const args: string[] = [];
  if (config.model) args.push("--model", config.model);
  if (config.modeId) args.push("--approval-mode", config.modeId);
  return { command: "codex", args, env: {} };
}

buildTerminalResumeCommand(handle: AgentPersistenceHandle): TerminalCommand {
  return {
    command: "codex",
    args: ["--resume", handle.nativeHandle ?? handle.sessionId],
    env: {},
  };
}
```

**OpenCode** (`packages/server/src/server/agent/providers/opencode-agent.ts`):
```typescript
buildTerminalCreateCommand(config: AgentSessionConfig): TerminalCommand {
  return { command: "opencode", args: [], env: {} };
}
// No resume support for OpenCode initially
```

Capabilities for each provider:
- Claude: `supportsTerminalMode: true`
- Codex: `supportsTerminalMode: true`
- OpenCode: `supportsTerminalMode: true`

#### 1.7 Handle terminal agent creation in `AgentManager.createAgent()`

**File:** `packages/server/src/server/agent/agent-manager.ts`

When `config.terminal === true`:
1. Do NOT call `client.createSession()` — there is no managed session
2. Call `client.buildTerminalCreateCommand(config)` to get the command
3. Create a `TerminalSession` via `terminalManager.createTerminal()` with the command
4. Register the agent with `terminal: true`, `lifecycle: "idle"`, `session: null`
5. Store the terminal ID in the agent's metadata or a new field
6. The agent's persistence handle can be populated later (the CLI will create its own session file)

```typescript
async createAgent(config: AgentSessionConfig, agentId?: string, options?: { labels?: Record<string, string> }): Promise<ManagedAgent> {
  const resolvedAgentId = validateAgentId(agentId ?? this.idFactory(), "createAgent");
  const normalizedConfig = await this.normalizeConfig(config);
  const client = this.requireClient(normalizedConfig.provider);

  if (normalizedConfig.terminal) {
    // Terminal mode — no managed session, just build the command
    const buildCmd = client.buildTerminalCreateCommand;
    if (!buildCmd) {
      throw new Error(`Provider '${normalizedConfig.provider}' does not support terminal mode`);
    }
    const cmd = buildCmd.call(client, normalizedConfig);
    return this.registerTerminalAgent(resolvedAgentId, normalizedConfig, cmd, {
      labels: options?.labels,
    });
  }

  // ...existing managed agent flow...
}
```

New method `registerTerminalAgent()`:
- Creates a ManagedAgent with `terminal: true`
- Stores the `TerminalCommand` in agent metadata for later use (resume, reconnect)
- Sets lifecycle to `"idle"` (the terminal itself manages the agent's internal state)
- Does NOT have an `AgentSession` — the `session` field is `null` (like closed agents)
- Broadcasts `agent_state` event so clients know about it

#### 1.8 New message: create terminal for agent

The client needs a way to request a terminal for a terminal agent. Options:

**Option A:** Extend `createTerminal` to accept an agent ID. When provided, the server looks up the agent, gets the command, and creates a terminal pre-configured with that command.

**Option B:** New message type `create_terminal_agent_request` that combines agent creation + terminal creation in one step.

**Recommendation: Option A.** Add optional `agentId` to `CreateTerminalRequestMessage`. If provided:
- Look up the agent (must be a terminal agent)
- Use the agent's stored command to create the terminal
- Associate the terminal with the agent

**File:** `packages/server/src/shared/messages.ts`

```typescript
const CreateTerminalRequestMessageSchema = z.object({
  type: z.literal("create_terminal_request"),
  cwd: z.string(),
  name: z.string().optional(),
  agentId: z.string().optional(),  // NEW — if provided, create terminal for this terminal agent
  requestId: z.string(),
});
```

#### 1.9 Terminal → Agent lifecycle binding

When a terminal associated with a terminal agent exits:
- Set agent lifecycle to `"closed"`
- Attempt to detect the agent's session file for persistence handle
- Broadcast state update

When a terminal agent is opened from the sessions page:
- Server calls `buildTerminalResumeCommand(handle)` if persistence handle exists
- Otherwise calls `buildTerminalCreateCommand(config)`
- Creates a new terminal with that command

#### 1.10 Extend `createTerminal()` to support command + args

**File:** `packages/server/src/terminal/terminal.ts`

```typescript
export interface CreateTerminalOptions {
  cwd: string;
  shell?: string;
  env?: Record<string, string>;
  rows?: number;
  cols?: number;
  name?: string;
  command?: string;   // NEW — if provided, run this instead of shell
  args?: string[];    // NEW — arguments for command
}
```

In `createTerminal()`:
```typescript
const spawnCommand = options.command ?? shell;
const spawnArgs = options.command ? (options.args ?? []) : [];

const ptyProcess = pty.spawn(spawnCommand, spawnArgs, {
  name: "xterm-256color",
  cols, rows, cwd,
  env: { ...process.env, ...env, TERM: "xterm-256color" },
});
```

---

### Phase 2: App — Draft UI & Terminal Toggle

#### 2.1 Add terminal toggle to draft tab

**File:** `packages/app/src/screens/workspace/workspace-draft-agent-tab.tsx`

Add a toggle switch in the draft UI: **"Chat" / "Terminal"**

State:
```typescript
const [isTerminalMode, setIsTerminalMode] = useState(false);
```

The toggle should be persistent per draft (stored in the draft store or as a preference).

When terminal mode is selected:
- The provider/model pickers still work (same UI)
- The mode picker still works
- The "send" button label changes to "Launch" or "Start"
- The initial prompt input may be hidden or optional (terminal agents don't need an initial prompt — the user types directly into the TUI)

#### 2.2 Modify agent creation to pass `terminal: true`

When the user submits a draft in terminal mode:

```typescript
const config: AgentSessionConfig = {
  provider: selectedProvider,
  cwd: workspaceId,
  model: selectedModel,
  modeId: selectedMode,
  terminal: true,  // NEW
};
```

The `CreateAgentRequestMessage` already carries `config`, so no new wire message needed.

#### 2.3 Terminal mode in `AgentStatusBar`

**File:** `packages/app/src/components/agent-status-bar.tsx`

When rendering a draft's status bar, filter the capability:
- If `supportsTerminalMode` is false for a provider, disable the terminal toggle when that provider is selected
- The terminal toggle can live next to the provider selector or as a segmented control above the input area

---

### Phase 3: App — Agent Panel Rendering

#### 3.1 Branch rendering in `AgentPanel`

**File:** `packages/app/src/panels/agent-panel.tsx`

```typescript
function AgentPanelContent({ agentId, ... }) {
  const agent = useAgentState(agentId);

  if (agent?.terminal) {
    return <TerminalAgentPanel agentId={agentId} agent={agent} />;
  }

  return <AgentPanelBody agent={agent} ... />;
}
```

#### 3.2 New component: `TerminalAgentPanel`

**File:** `packages/app/src/panels/terminal-agent-panel.tsx` (new file)

This component:
1. Gets the terminal ID associated with the agent (from agent metadata or a new field)
2. Renders a `TerminalPane` connected to that terminal session
3. If no terminal exists yet (agent from sessions page), requests terminal creation via `createTerminal({ agentId })`
4. Handles terminal exit → agent close lifecycle

Essentially: it's the existing `TerminalPane` component, but associated with an agent entity instead of a standalone terminal.

#### 3.3 Tab descriptor for terminal agents

**File:** `packages/app/src/panels/agent-panel.tsx` → `useAgentPanelDescriptor`

The tab descriptor (icon, label) already comes from the agent's provider. Terminal agents get the same icon/label as managed agents — that's the whole point. No changes needed here unless we want a "terminal" badge.

Optional: add a small terminal icon badge to distinguish terminal agents from managed agents in the tab bar.

---

### Phase 4: Sessions Page

#### 4.1 Terminal agents appear in sessions list

No changes needed for listing — terminal agents are real agents, they already show up via `AgentManager.getAgents()`.

#### 4.2 Opening a terminal agent from sessions

**File:** `packages/app/src/screens/sessions/` (sessions screen)

When the user clicks a closed terminal agent:
1. Server calls `buildTerminalResumeCommand(handle)` if persistence exists
2. Creates a new terminal with that command
3. Opens agent tab in workspace

If no persistence handle (session was ephemeral), show "Start new session" which calls `buildTerminalCreateCommand(config)`.

---

### Phase 5: CLI Gating

#### 5.1 `paseo send` — error for terminal agents

**File:** `packages/cli/src/commands/send.ts`

```typescript
if (agent.terminal) {
  throw new Error("Cannot send messages to terminal agents. Open the terminal in the UI instead.");
}
```

#### 5.2 `paseo run` — could support `--terminal` flag (future)

Not in v1. For now, `paseo run` always creates managed agents. Terminal mode is UI-only.

#### 5.3 `paseo ls` — show terminal flag

Add a `terminal` column or badge to `paseo ls` output so users can distinguish terminal agents.

---

## Wire Format Changes Summary

### AgentSessionConfig (create request)
```diff
 {
   provider: string;
   cwd: string;
   model?: string;
   modeId?: string;
+  terminal?: boolean;
   ...
 }
```

### AgentState (server → client)
```diff
 {
   id: string;
   provider: string;
   lifecycle: string;
+  terminal?: boolean;
   ...
 }
```

### AgentCapabilityFlags
```diff
 {
   supportsStreaming: boolean;
   supportsSessionPersistence: boolean;
+  supportsTerminalMode: boolean;
   ...
 }
```

### CreateTerminalRequest
```diff
 {
   type: "create_terminal_request";
   cwd: string;
   name?: string;
+  agentId?: string;
   requestId: string;
 }
```

### TerminalCommand (new type)
```typescript
{
  command: string;
  args: string[];
  env?: Record<string, string>;
}
```

---

## Implementation Phases & Agent Assignments

### Phase 1: Server data model (1 agent)
- Add `terminal` to types, schemas, and agent manager
- Add `TerminalCommand` type and `buildTerminalCreateCommand`/`buildTerminalResumeCommand` to `AgentClient`
- Add `supportsTerminalMode` capability flag
- Extend `createTerminal()` to support command+args
- Implement terminal agent creation flow in `AgentManager`
- Wire terminal exit → agent close lifecycle
- Implement command builders in Claude, Codex, OpenCode providers
- Typecheck must pass

### Phase 2: App draft UI + terminal toggle (1 agent)
- Add terminal mode toggle to `workspace-draft-agent-tab.tsx`
- Pass `terminal: true` in config when toggle is on
- Filter toggle based on `supportsTerminalMode` capability
- Persist toggle preference
- Typecheck must pass

### Phase 3: App panel rendering (1 agent)
- Branch `AgentPanelContent` on `agent.terminal`
- Create `TerminalAgentPanel` component
- Handle terminal creation for agent on open
- Handle terminal exit lifecycle
- Typecheck must pass

### Phase 4: Sessions page + CLI gating (1 agent)
- Terminal agents show in sessions with badge
- Opening from sessions resumes or creates terminal
- `paseo send` errors for terminal agents
- `paseo ls` shows terminal badge
- Typecheck must pass

---

## Feature Interaction Guards

Terminal agents are explicitly excluded from automated dispatch paths:

- **LoopService**: `buildWorkerConfig` and `buildVerifierConfig` set `terminal: false`
- **ScheduleService**: `executeSchedule` rejects terminal agents with a clear error for agent-targeted schedules; new-agent schedules set `terminal: false`
- **Voice mode / `handleSendAgentMessage`**: Guarded by `getStructuredSendRejection()` before send
- **CLI `paseo send`**: Returns error for terminal agents
- **MCP agent creation**: Programmatic paths don't pass `terminal: true`

All session-specific operations (`runAgent`, `streamAgent`, `setMode`, `cancelAgentRun`, etc.) are guarded by the centralized `requireSessionAgent()` which rejects terminal agents.

## What This Does NOT Change

- The existing managed agent flow is untouched
- Terminal sessions (non-agent) still work as before
- The `AgentSession` interface is unchanged
- Mobile experience is unchanged (terminal mode is web/desktop only for now)
- No new providers are added (existing providers gain terminal command builders)
- No hooks, no env injection, no process tree detection (v1 keeps it simple)

## Future Work (Not In This Plan)

- Auto-detect agent type from PTY process tree (for standalone terminals)
- "Convert to chat" / "Convert to terminal" actions
- Terminal title/icon from OSC sequences
- `paseo run --terminal` CLI support
- Mobile terminal mode (if xterm.js works well enough on mobile web)
- Gemini / Aider / Goose provider definitions (terminal-only providers)
