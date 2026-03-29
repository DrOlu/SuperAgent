import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => {
  const storage = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        storage.delete(key);
      }),
    },
  };
});

import { useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import {
  buildTerminalAgentReopenKey,
  useTerminalAgentReopenStore,
} from "@/stores/terminal-agent-reopen-store";
import { prepareWorkspaceTab } from "@/utils/workspace-navigation";

const SERVER_ID = "server-1";
const WORKSPACE_ID = "/repo/worktree";
const AGENT_ID = "agent-1";

describe("prepareWorkspaceTab", () => {
  beforeEach(() => {
    useWorkspaceLayoutStore.setState({
      layoutByWorkspace: {},
      splitSizesByWorkspace: {},
      pinnedAgentIdsByWorkspace: {},
    });
    useTerminalAgentReopenStore.setState({
      reopenIntentVersionByAgentKey: {},
      requestReopen: useTerminalAgentReopenStore.getState().requestReopen,
    });
  });

  it("publishes a reopen intent when requested for an agent tab", () => {
    const route = prepareWorkspaceTab({
      serverId: SERVER_ID,
      workspaceId: WORKSPACE_ID,
      target: { kind: "agent", agentId: AGENT_ID },
      requestReopen: true,
    });

    const reopenKey = buildTerminalAgentReopenKey({ serverId: SERVER_ID, agentId: AGENT_ID });
    expect(reopenKey).toBeTruthy();
    expect(route).toBe("/h/server-1/workspace/L3JlcG8vd29ya3RyZWU");
    expect(
      useTerminalAgentReopenStore.getState().reopenIntentVersionByAgentKey[reopenKey as string],
    ).toBe(1);
  });

  it("does not publish a reopen intent unless explicitly requested", () => {
    prepareWorkspaceTab({
      serverId: SERVER_ID,
      workspaceId: WORKSPACE_ID,
      target: { kind: "agent", agentId: AGENT_ID },
    });

    const reopenKey = buildTerminalAgentReopenKey({ serverId: SERVER_ID, agentId: AGENT_ID });
    expect(reopenKey).toBeTruthy();
    expect(
      useTerminalAgentReopenStore.getState().reopenIntentVersionByAgentKey[reopenKey as string],
    ).toBeUndefined();
  });
});
