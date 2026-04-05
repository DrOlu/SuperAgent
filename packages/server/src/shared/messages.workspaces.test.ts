import { describe, expect, test } from "vitest";
import { SessionInboundMessageSchema, SessionOutboundMessageSchema } from "./messages.js";

describe("workspace message schemas", () => {
  test("parses fetch_workspaces_request", () => {
    const parsed = SessionInboundMessageSchema.parse({
      type: "fetch_workspaces_request",
      requestId: "req-1",
      filter: {
        query: "repo",
        projectId: 12,
        idPrefix: "/Users/me",
      },
      sort: [{ key: "activity_at", direction: "desc" }],
      page: { limit: 50 },
      subscribe: {},
    });

    expect(parsed.type).toBe("fetch_workspaces_request");
  });

  test("parses open_project_request", () => {
    const parsed = SessionInboundMessageSchema.parse({
      type: "open_project_request",
      cwd: "/tmp/repo",
      requestId: "req-open",
    });

    expect(parsed.type).toBe("open_project_request");
  });

  test("rejects invalid workspace update payload", () => {
    const result = SessionOutboundMessageSchema.safeParse({
      type: "workspace_update",
      payload: {
        kind: "upsert",
        workspace: {
          id: 1,
          projectId: 1,
          projectDisplayName: "repo",
          projectRootPath: "/repo",
          projectKind: "directory",
          workspaceKind: "checkout",
          name: "",
          status: "not-a-bucket",
          activityAt: null,
          services: [],
        },
      },
    });

    expect(result.success).toBe(false);
  });

  test("parses workspace descriptors with services", () => {
    const parsed = SessionOutboundMessageSchema.parse({
      type: "workspace_update",
      payload: {
        kind: "upsert",
        workspace: {
          id: 1,
          projectId: 1,
          projectDisplayName: "repo",
          projectRootPath: "/repo",
          workspaceDirectory: "/repo",
          projectKind: "directory",
          workspaceKind: "checkout",
          name: "repo",
          status: "done",
          activityAt: null,
          services: [
            {
              serviceName: "web",
              hostname: "web.localhost",
              port: 3000,
              url: "http://web.localhost:6767",
              status: "running",
            },
          ],
        },
      },
    });

    expect(parsed.type).toBe("workspace_update");
    if (parsed.type !== "workspace_update" || parsed.payload.kind !== "upsert") {
      throw new Error("Expected workspace_update upsert payload");
    }
    expect(parsed.payload.workspace.services).toEqual([
      {
        serviceName: "web",
        hostname: "web.localhost",
        port: 3000,
        url: "http://web.localhost:6767",
        status: "running",
      },
    ]);
  });

  test("parses service_status_update payload", () => {
    const parsed = SessionOutboundMessageSchema.parse({
      type: "service_status_update",
      payload: {
        workspaceId: "/repo",
        services: [
          {
            serviceName: "web",
            hostname: "web.localhost",
            port: 3000,
            url: null,
            status: "stopped",
          },
        ],
      },
    });

    expect(parsed.type).toBe("service_status_update");
    expect(parsed.payload.workspaceId).toBe("/repo");
  });

  test("parses workspace_setup_progress payload", () => {
    const parsed = SessionOutboundMessageSchema.parse({
      type: "workspace_setup_progress",
      payload: {
        workspaceId: "/repo/.paseo/worktrees/feature-a",
        status: "completed",
        detail: {
          type: "worktree_setup",
          worktreePath: "/repo/.paseo/worktrees/feature-a",
          branchName: "feature-a",
          log: "done",
          commands: [
            {
              index: 1,
              command: "npm install",
              cwd: "/repo/.paseo/worktrees/feature-a",
              log: "done",
              status: "completed",
              exitCode: 0,
              durationMs: 100,
            },
          ],
        },
        error: null,
      },
    });

    expect(parsed.type).toBe("workspace_setup_progress");
  });

  test("parses workspace_setup_status_request", () => {
    const parsed = SessionInboundMessageSchema.parse({
      type: "workspace_setup_status_request",
      workspaceId: "/repo/.paseo/worktrees/feature-a",
      requestId: "req-status",
    });

    expect(parsed.type).toBe("workspace_setup_status_request");
  });

  test("parses workspace_setup_status_response payload", () => {
    const parsed = SessionOutboundMessageSchema.parse({
      type: "workspace_setup_status_response",
      payload: {
        requestId: "req-status",
        workspaceId: "/repo/.paseo/worktrees/feature-a",
        snapshot: {
          status: "completed",
          detail: {
            type: "worktree_setup",
            worktreePath: "/repo/.paseo/worktrees/feature-a",
            branchName: "feature-a",
            log: "done",
            commands: [],
          },
          error: null,
        },
      },
    });

    expect(parsed.type).toBe("workspace_setup_status_response");
  });

  test("parses legacy fetch_agents_response checkout payloads without worktreeRoot", () => {
    const result = SessionOutboundMessageSchema.safeParse({
      type: "fetch_agents_response",
      payload: {
        requestId: "req-1",
        entries: [
          {
            agent: {
              id: "agent-1",
              provider: "codex",
              cwd: "C:\\repo",
              model: null,
              features: [],
              thinkingOptionId: null,
              effectiveThinkingOptionId: null,
              createdAt: "2026-04-04T00:00:00.000Z",
              updatedAt: "2026-04-04T00:00:00.000Z",
              lastUserMessageAt: null,
              status: "running",
              capabilities: {
                supportsStreaming: true,
                supportsSessionPersistence: true,
                supportsDynamicModes: true,
                supportsMcpServers: true,
                supportsReasoningStream: true,
                supportsToolInvocations: true,
              },
              currentModeId: null,
              availableModes: [],
              pendingPermissions: [],
              persistence: null,
              title: "Agent 1",
              labels: {},
              requiresAttention: false,
              attentionReason: null,
            },
            project: {
              projectKey: "remote:github.com/acme/repo",
              projectName: "acme/repo",
              checkout: {
                cwd: "C:\\repo",
                isGit: true,
                currentBranch: "main",
                remoteUrl: "https://github.com/acme/repo.git",
                isPaseoOwnedWorktree: false,
                mainRepoRoot: null,
              },
            },
          },
        ],
        pageInfo: {
          nextCursor: null,
          prevCursor: null,
          hasMore: false,
        },
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }

    const checkout = result.data.payload.entries[0]?.project.checkout;
    expect(checkout?.worktreeRoot).toBe("C:\\repo");
  });
});
