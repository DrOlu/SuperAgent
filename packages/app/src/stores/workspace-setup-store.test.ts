import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceSetupStore } from "./workspace-setup-store";

describe("workspace-setup-store", () => {
  beforeEach(() => {
    useWorkspaceSetupStore.setState({ pendingWorkspaceSetup: null });
  });

  it("tracks deferred project setup by path instead of a created workspace", () => {
    useWorkspaceSetupStore.getState().beginWorkspaceSetup({
      serverId: "server-1",
      projectPath: "/Users/test/project",
      projectName: "project",
      creationMethod: "open_project",
      navigationMethod: "replace",
    });

    expect(useWorkspaceSetupStore.getState().pendingWorkspaceSetup).toEqual({
      serverId: "server-1",
      projectPath: "/Users/test/project",
      projectName: "project",
      creationMethod: "open_project",
      navigationMethod: "replace",
    });
  });

  it("clears pending setup state", () => {
    useWorkspaceSetupStore.getState().beginWorkspaceSetup({
      serverId: "server-1",
      projectPath: "/Users/test/project",
      creationMethod: "create_worktree",
      navigationMethod: "navigate",
    });

    useWorkspaceSetupStore.getState().clearWorkspaceSetup();

    expect(useWorkspaceSetupStore.getState().pendingWorkspaceSetup).toBeNull();
  });
});
