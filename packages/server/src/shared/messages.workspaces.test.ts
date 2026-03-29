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
        },
      },
    });

    expect(result.success).toBe(false);
  });
});
