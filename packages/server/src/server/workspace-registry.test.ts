import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { beforeEach, afterEach, describe, expect, test } from "vitest";

import { createTestLogger } from "../test-utils/test-logger.js";
import {
  FileBackedProjectRegistry,
  FileBackedWorkspaceRegistry,
} from "./workspace-registry.test-helpers.js";
import {
  createPersistedProjectRecord,
  createPersistedWorkspaceRecord,
} from "./workspace-registry.js";

describe("workspace registries", () => {
  let tmpDir: string;
  let projectRegistry: FileBackedProjectRegistry;
  let workspaceRegistry: FileBackedWorkspaceRegistry;
  const logger = createTestLogger();

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "workspace-registry-"));
    projectRegistry = new FileBackedProjectRegistry(
      path.join(tmpDir, "projects", "projects.json"),
      logger,
    );
    workspaceRegistry = new FileBackedWorkspaceRegistry(
      path.join(tmpDir, "projects", "workspaces.json"),
      logger,
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("creates, updates, archives, deletes, and lists project records", async () => {
    await projectRegistry.initialize();
    const projectId = await projectRegistry.insert({
      directory: "/tmp/repo",
      kind: "git",
      displayName: "acme/repo",
      gitRemote: "git@github.com:acme/repo.git",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      archivedAt: null,
    });

    await projectRegistry.upsert(
      createPersistedProjectRecord({
        id: projectId,
        directory: "/tmp/repo",
        kind: "git",
        displayName: "acme/repo",
        gitRemote: "git@github.com:acme/repo.git",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      }),
    );
    await projectRegistry.archive(projectId, "2026-03-03T00:00:00.000Z");

    const archived = await projectRegistry.get(projectId);
    expect(archived?.archivedAt).toBe("2026-03-03T00:00:00.000Z");
    expect(await projectRegistry.list()).toHaveLength(1);

    await projectRegistry.remove(projectId);
    expect(await projectRegistry.get(projectId)).toBeNull();
    expect(await projectRegistry.list()).toEqual([]);
  });

  test("creates, updates, archives, deletes, and lists workspace records", async () => {
    await workspaceRegistry.initialize();
    const projectId = await projectRegistry.insert({
      directory: "/tmp/repo",
      kind: "git",
      displayName: "acme/repo",
      gitRemote: "git@github.com:acme/repo.git",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      archivedAt: null,
    });
    const workspaceId = await workspaceRegistry.insert({
      projectId,
      directory: "/tmp/repo",
      kind: "checkout",
      displayName: "main",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      archivedAt: null,
    });

    await workspaceRegistry.upsert(
      createPersistedWorkspaceRecord({
        id: workspaceId,
        projectId,
        directory: "/tmp/repo",
        kind: "checkout",
        displayName: "feature/workspace",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-02T00:00:00.000Z",
      }),
    );
    await workspaceRegistry.archive(workspaceId, "2026-03-03T00:00:00.000Z");

    const archived = await workspaceRegistry.get(workspaceId);
    expect(archived?.displayName).toBe("feature/workspace");
    expect(archived?.archivedAt).toBe("2026-03-03T00:00:00.000Z");

    await workspaceRegistry.remove(workspaceId);
    expect(await workspaceRegistry.get(workspaceId)).toBeNull();
    expect(await workspaceRegistry.list()).toEqual([]);
  });
});
