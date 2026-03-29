import os from "node:os";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type { PersistedProjectRecord, PersistedWorkspaceRecord } from "../workspace-registry.js";
import { createPersistedProjectRecord, createPersistedWorkspaceRecord } from "../workspace-registry.js";
import { openPaseoDatabase, type PaseoDatabaseHandle } from "./sqlite-database.js";
import { DbProjectRegistry } from "./db-project-registry.js";
import { DbWorkspaceRegistry } from "./db-workspace-registry.js";

function createProjectRecord(input: Partial<PersistedProjectRecord> = {}): PersistedProjectRecord {
  return createPersistedProjectRecord({
    id: 1,
    directory: "/tmp/repo",
    kind: "git",
    displayName: "acme/repo",
    gitRemote: "git@github.com:acme/repo.git",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    archivedAt: null,
    ...input,
  });
}

function createWorkspaceRecord(input: Partial<PersistedWorkspaceRecord> = {}): PersistedWorkspaceRecord {
  return createPersistedWorkspaceRecord({
    id: 1,
    projectId: 1,
    directory: "/tmp/repo",
    kind: "checkout",
    displayName: "main",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    archivedAt: null,
    ...input,
  });
}

describe("DB-backed workspace registries", () => {
  let tmpDir: string;
  let dataDir: string;
  let database: PaseoDatabaseHandle;
  let projectRegistry: DbProjectRegistry;
  let workspaceRegistry: DbWorkspaceRegistry;

  beforeEach(async () => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "db-workspace-registry-"));
    dataDir = path.join(tmpDir, "db");
    database = await openPaseoDatabase(dataDir);
    projectRegistry = new DbProjectRegistry(database.db);
    workspaceRegistry = new DbWorkspaceRegistry(database.db);
  });

  afterEach(async () => {
    await database.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("project registry matches the file-backed behavioral contract", async () => {
    await projectRegistry.initialize();
    expect(await projectRegistry.existsOnDisk()).toBe(true);
    expect(await projectRegistry.get(999)).toBeNull();
    expect(await projectRegistry.list()).toEqual([]);

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
      createProjectRecord({
        id: projectId,
        updatedAt: "2026-03-02T00:00:00.000Z",
      }),
    );
    await projectRegistry.archive(projectId, "2026-03-03T00:00:00.000Z");
    await projectRegistry.archive(999, "2026-03-04T00:00:00.000Z");

    expect(await projectRegistry.get(projectId)).toEqual(
      createProjectRecord({
        id: projectId,
        updatedAt: "2026-03-03T00:00:00.000Z",
        archivedAt: "2026-03-03T00:00:00.000Z",
      }),
    );
    expect(await projectRegistry.list()).toEqual([
      createProjectRecord({
        updatedAt: "2026-03-03T00:00:00.000Z",
        archivedAt: "2026-03-03T00:00:00.000Z",
      }),
    ]);

    await projectRegistry.remove(999);
    await projectRegistry.remove(projectId);

    expect(await projectRegistry.get(projectId)).toBeNull();
    expect(await projectRegistry.list()).toEqual([]);
  });

  test("workspace registry matches the file-backed behavioral contract", async () => {
    await workspaceRegistry.initialize();
    expect(await workspaceRegistry.existsOnDisk()).toBe(true);
    expect(await workspaceRegistry.get(999)).toBeNull();
    expect(await workspaceRegistry.list()).toEqual([]);

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
      createWorkspaceRecord({
        id: workspaceId,
        projectId,
        displayName: "feature/workspace",
        updatedAt: "2026-03-02T00:00:00.000Z",
      }),
    );
    await workspaceRegistry.archive(workspaceId, "2026-03-03T00:00:00.000Z");
    await workspaceRegistry.archive(999, "2026-03-04T00:00:00.000Z");

    expect(await workspaceRegistry.get(workspaceId)).toEqual(
      createWorkspaceRecord({
        id: workspaceId,
        projectId,
        displayName: "feature/workspace",
        updatedAt: "2026-03-03T00:00:00.000Z",
        archivedAt: "2026-03-03T00:00:00.000Z",
      }),
    );
    expect(await workspaceRegistry.list()).toEqual([
      createWorkspaceRecord({
        displayName: "feature/workspace",
        updatedAt: "2026-03-03T00:00:00.000Z",
        archivedAt: "2026-03-03T00:00:00.000Z",
      }),
    ]);

    await workspaceRegistry.remove(999);
    await workspaceRegistry.remove(workspaceId);

    expect(await workspaceRegistry.get(workspaceId)).toBeNull();
    expect(await workspaceRegistry.list()).toEqual([]);
  });

  test("rejects workspace upserts for non-existent projects", async () => {
    await expect(
      workspaceRegistry.upsert(
        createWorkspaceRecord({
          projectId: 999,
        }),
      ),
    ).rejects.toThrow();
  });

  test("cascades workspace removal when removing a linked project", async () => {
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

    await projectRegistry.remove(projectId);
    expect(await projectRegistry.get(projectId)).toBeNull();
    expect(await workspaceRegistry.get(workspaceId)).toBeNull();
  });
});
