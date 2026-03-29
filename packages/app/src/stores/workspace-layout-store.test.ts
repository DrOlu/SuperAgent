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

import type { WorkspaceTab } from "@/stores/workspace-tabs-store";
import {
  buildWorkspaceTabPersistenceKey,
  collectAllPanes,
  collectAllTabs,
  createDefaultLayout,
  findPaneById,
  findPaneContainingTab,
  getTreeDepth,
  insertSplit,
  removePaneFromTree,
  removeTabFromTree,
  useWorkspaceLayoutStore,
  type SplitNode,
} from "@/stores/workspace-layout-store";

const SERVER_ID = "server-1";
const WORKSPACE_ID = "/repo/worktree";

function createTab(tabId: string): WorkspaceTab {
  return {
    tabId,
    target: { kind: "draft", draftId: tabId },
    createdAt: 1,
  };
}

function createPane(input: {
  id: string;
  tabIds: string[];
  focusedTabId?: string | null;
}): SplitNode {
  const tabs = input.tabIds.map((tabId) => createTab(tabId));
  return {
    kind: "pane",
    pane: {
      id: input.id,
      tabIds: input.tabIds,
      focusedTabId: input.focusedTabId ?? input.tabIds[input.tabIds.length - 1] ?? null,
      tabs,
    } as any,
  };
}

function createWorkspaceKey(): string {
  const key = buildWorkspaceTabPersistenceKey({
    serverId: SERVER_ID,
    workspaceId: WORKSPACE_ID,
  });
  expect(key).toBeTruthy();
  return key as string;
}

function expectGroup(node: SplitNode): Extract<SplitNode, { kind: "group" }> {
  expect(node.kind).toBe("group");
  return node as Extract<SplitNode, { kind: "group" }>;
}

describe("workspace-layout-store helpers", () => {
  it("finds panes and tabs across nested groups", () => {
    const root: SplitNode = {
      kind: "group",
      group: {
        id: "group-root",
        direction: "horizontal",
        sizes: [0.4, 0.6],
        children: [
          createPane({ id: "left", tabIds: ["tab-a", "tab-b"], focusedTabId: "tab-a" }),
          {
            kind: "group",
            group: {
              id: "group-right",
              direction: "vertical",
              sizes: [0.5, 0.5],
              children: [
                createPane({ id: "top-right", tabIds: ["tab-c"] }),
                createPane({ id: "bottom-right", tabIds: ["tab-d"] }),
              ],
            },
          },
        ],
      },
    };

    expect(findPaneById(root, "top-right")?.tabIds).toEqual(["tab-c"]);
    expect(findPaneContainingTab(root, "tab-b")?.id).toBe("left");
    expect(getTreeDepth(root)).toBe(3);
    expect(collectAllPanes(root).map((pane) => pane.id)).toEqual([
      "left",
      "top-right",
      "bottom-right",
    ]);
    expect(collectAllTabs(root).map((tab) => tab.tabId)).toEqual([
      "tab-a",
      "tab-b",
      "tab-c",
      "tab-d",
    ]);
  });
});

describe("workspace-layout-store tree transforms", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("insertSplit wraps root-level same-direction splits in a nested group", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111")
      .mockReturnValueOnce("22222222-2222-2222-2222-222222222222");

    const root: SplitNode = {
      kind: "group",
      group: {
        id: "group-root",
        direction: "horizontal",
        sizes: [0.25, 0.75],
        children: [
          createPane({ id: "left", tabIds: ["tab-a"] }),
          createPane({ id: "right", tabIds: ["tab-b", "tab-c"] }),
        ],
      },
    };

    const nextRoot = insertSplit(root, "right", "tab-c", "right");
    const nextGroup = expectGroup(nextRoot);
    const nestedGroup = expectGroup(nextGroup.group.children[1]!);

    expect(nextGroup.group.direction).toBe("horizontal");
    expect(nextGroup.group.children).toHaveLength(2);
    expect(nextGroup.group.sizes).toEqual([0.25, 0.75]);
    expect(nestedGroup.group.id).toBe("group_22222222-2222-2222-2222-222222222222");
    expect(nestedGroup.group.direction).toBe("horizontal");
    expect(nestedGroup.group.sizes).toEqual([0.5, 0.5]);
    expect(collectAllPanes(nextRoot).map((pane) => pane.id)).toEqual([
      "left",
      "right",
      "pane_11111111-1111-1111-1111-111111111111",
    ]);
    expect(findPaneById(nextRoot, "right")?.tabIds).toEqual(["tab-b"]);
    expect(findPaneById(nextRoot, "pane_11111111-1111-1111-1111-111111111111")?.tabIds).toEqual([
      "tab-c",
    ]);
  });

  it("removePaneFromTree unwraps single-child groups and renormalizes siblings", () => {
    const root: SplitNode = {
      kind: "group",
      group: {
        id: "group-root",
        direction: "horizontal",
        sizes: [0.2, 0.8],
        children: [
          createPane({ id: "left", tabIds: ["tab-a"] }),
          {
            kind: "group",
            group: {
              id: "group-right",
              direction: "vertical",
              sizes: [0.5, 0.5],
              children: [
                createPane({ id: "top-right", tabIds: ["tab-b"] }),
                createPane({ id: "bottom-right", tabIds: ["tab-c"] }),
              ],
            },
          },
        ],
      },
    };

    const nextRoot = removePaneFromTree(root, "top-right");
    const nextGroup = expectGroup(nextRoot);

    expect(nextGroup.group.sizes).toEqual([0.2, 0.8]);
    expect(collectAllPanes(nextRoot).map((pane) => pane.id)).toEqual(["left", "bottom-right"]);
    expect(nextGroup.group.children[1]).toEqual(
      createPane({ id: "bottom-right", tabIds: ["tab-c"] }),
    );
  });

  it("removeTabFromTree collapses empty panes but keeps the final root pane", () => {
    const splitRoot: SplitNode = {
      kind: "group",
      group: {
        id: "group-root",
        direction: "horizontal",
        sizes: [0.5, 0.5],
        children: [
          createPane({ id: "left", tabIds: ["tab-a"] }),
          createPane({ id: "right", tabIds: ["tab-b"] }),
        ],
      },
    };

    const collapsed = removeTabFromTree(splitRoot, "tab-a");
    expect(collapsed).toEqual(createPane({ id: "right", tabIds: ["tab-b"] }));

    const singlePaneRoot = createPane({ id: "main", tabIds: ["tab-a"] });
    const emptied = removeTabFromTree(singlePaneRoot, "tab-a");
    expect(emptied).toEqual(createPane({ id: "main", tabIds: [], focusedTabId: null }));
  });
});

describe("workspace-layout-store actions", () => {
  beforeEach(() => {
    useWorkspaceLayoutStore.setState({
      layoutByWorkspace: {},
      splitSizesByWorkspace: {},
      pinnedAgentIdsByWorkspace: {},
    });
    vi.restoreAllMocks();
  });

  it("opens tabs into the focused pane and focuses duplicate opens instead of creating them", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const firstTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: secondTabId!,
      targetPaneId: "main",
      position: "right",
    });

    expect(splitPaneId).toBe("pane_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    store.focusPane(workspaceKey, "main");
    const duplicateTabId = store.openTab(workspaceKey, {
      kind: "file",
      path: "/repo/worktree/b.ts",
    });
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(firstTabId).toBe("file_/repo/worktree/a.ts");
    expect(secondTabId).toBe("file_/repo/worktree/b.ts");
    expect(duplicateTabId).toBe(secondTabId);
    expect(layout.focusedPaneId).toBe("pane_aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(collectAllTabs(layout.root).map((tab) => tab.tabId)).toEqual([
      "file_/repo/worktree/a.ts",
      "file_/repo/worktree/b.ts",
    ]);
  });

  it("openLauncherTab creates duplicate launcher tabs for repeated Cmd+T/new-tab opens", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111")
      .mockReturnValueOnce("22222222-2222-2222-2222-222222222222");
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const firstTabId = store.openLauncherTab(workspaceKey);
    const secondTabId = store.openLauncherTab(workspaceKey);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(firstTabId).toBe("launcher_11111111-1111-1111-1111-111111111111");
    expect(secondTabId).toBe("launcher_22222222-2222-2222-2222-222222222222");
    expect(firstTabId).not.toBe(secondTabId);
    expect(findPaneById(layout.root, "main")?.tabIds).toEqual([firstTabId, secondTabId]);
    expect(collectAllTabs(layout.root)).toEqual([
      {
        tabId: firstTabId,
        target: { kind: "launcher", launcherId: "11111111-1111-1111-1111-111111111111" },
        createdAt: expect.any(Number),
      },
      {
        tabId: secondTabId,
        target: { kind: "launcher", launcherId: "22222222-2222-2222-2222-222222222222" },
        createdAt: expect.any(Number),
      },
    ]);
  });

  it("splitPaneEmpty plus openLauncherTab opens a launcher tab in the new pane", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValueOnce(
      "77777777-7777-7777-7777-777777777777",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const newPaneId = store.splitPaneEmpty(workspaceKey, {
      targetPaneId: "main",
      position: "right",
    });
    const launcherTabId = store.openLauncherTab(workspaceKey);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(newPaneId).toBe("pane_77777777-7777-7777-7777-777777777777");
    expect(launcherTabId).toMatch(/^launcher_/);
    expect(layout.focusedPaneId).toBe(newPaneId);
    expect(findPaneById(layout.root, "main")?.tabIds).toEqual(["file_/repo/worktree/a.ts"]);
    expect(findPaneById(layout.root, newPaneId!)?.tabIds).toEqual([launcherTabId!]);
    expect(findPaneById(layout.root, newPaneId!)?.focusedTabId).toBe(launcherTabId);
  });

  it("focusTab moves workspace focus to the pane containing the tab", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const fileTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const terminalTabId = store.openTab(workspaceKey, { kind: "terminal", terminalId: "term-1" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: terminalTabId!,
      targetPaneId: "main",
      position: "right",
    });

    store.focusTab(workspaceKey, fileTabId!);
    let layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    expect(layout.focusedPaneId).toBe("main");

    store.focusTab(workspaceKey, terminalTabId!);
    layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    expect(splitPaneId).toBe("pane_bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    expect(layout.focusedPaneId).toBe(splitPaneId);
    expect(findPaneById(layout.root, splitPaneId!)?.focusedTabId).toBe(terminalTabId);
  });

  it("convertDraftToAgent replaces the draft tab with a canonical agent tab in the same pane", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "12121212-1212-1212-1212-121212121212",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "draft", draftId: "draft-2" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: secondTabId!,
      targetPaneId: "main",
      position: "right",
    });

    const nextTabId = store.convertDraftToAgent(workspaceKey, secondTabId!, "agent-1");
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    const splitPane = findPaneById(layout.root, splitPaneId!);
    const convertedTab = collectAllTabs(layout.root).find((tab) => tab.tabId === nextTabId);

    expect(splitPaneId).toBe("pane_12121212-1212-1212-1212-121212121212");
    expect(nextTabId).toBe("agent_agent-1");
    expect(splitPane?.tabIds).toEqual(["agent_agent-1"]);
    expect(findPaneContainingTab(layout.root, "agent_agent-1")?.id).toBe(splitPaneId);
    expect(convertedTab).toEqual({
      tabId: "agent_agent-1",
      target: { kind: "agent", agentId: "agent-1" },
      createdAt: expect.any(Number),
    });
  });

  it("retargetTab keeps a launcher tab in place while updating its target", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "33333333-3333-3333-3333-333333333333",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const launcherTabId = store.openLauncherTab(workspaceKey);
    const nextTabId = store.retargetTab(workspaceKey, launcherTabId!, {
      kind: "file",
      path: "/repo/worktree/launcher.ts",
    });
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(launcherTabId).toBe("launcher_33333333-3333-3333-3333-333333333333");
    expect(nextTabId).toBe(launcherTabId);
    expect(findPaneById(layout.root, "main")?.tabIds).toEqual([launcherTabId!]);
    expect(collectAllTabs(layout.root)).toEqual([
      {
        tabId: launcherTabId!,
        target: { kind: "file", path: "/repo/worktree/launcher.ts" },
        createdAt: expect.any(Number),
      },
    ]);
  });

  it("retargetTab closes a launcher tab and focuses the existing canonical target tab", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("44444444-4444-4444-4444-444444444444")
      .mockReturnValueOnce("55555555-5555-5555-5555-555555555555")
      .mockReturnValueOnce("66666666-6666-6666-6666-666666666666");
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const existingFileTabId = store.openTab(workspaceKey, {
      kind: "file",
      path: "/repo/worktree/existing.ts",
    });
    const launcherTabId = store.openLauncherTab(workspaceKey);
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: launcherTabId!,
      targetPaneId: "main",
      position: "right",
    });
    const secondLauncherTabId = store.openLauncherTab(workspaceKey);

    const nextTabId = store.retargetTab(workspaceKey, secondLauncherTabId!, {
      kind: "file",
      path: "/repo/worktree/existing.ts",
    });
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(existingFileTabId).toBe("file_/repo/worktree/existing.ts");
    expect(launcherTabId).toBe("launcher_44444444-4444-4444-4444-444444444444");
    expect(splitPaneId).toBe("pane_55555555-5555-5555-5555-555555555555");
    expect(secondLauncherTabId).toMatch(/^launcher_/);
    expect(secondLauncherTabId).not.toBe(launcherTabId);
    expect(nextTabId).toBe(existingFileTabId);
    expect(collectAllTabs(layout.root).map((tab) => tab.tabId)).toEqual([
      existingFileTabId!,
      launcherTabId!,
    ]);
    expect(layout.focusedPaneId).toBe("main");
    expect(findPaneById(layout.root, "main")?.focusedTabId).toBe(existingFileTabId);
  });

  it("retargetTab closes a launcher tab and focuses an existing matching target tab", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("77777777-7777-7777-7777-777777777777")
      .mockReturnValueOnce("88888888-8888-8888-8888-888888888888");
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const firstLauncherTabId = store.openLauncherTab(workspaceKey);
    const firstAgentTabId = store.retargetTab(workspaceKey, firstLauncherTabId!, {
      kind: "agent",
      agentId: "agent-1",
    });
    const secondLauncherTabId = store.openLauncherTab(workspaceKey);

    const nextTabId = store.retargetTab(workspaceKey, secondLauncherTabId!, {
      kind: "agent",
      agentId: "agent-1",
    });
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(firstAgentTabId).toBe(firstLauncherTabId);
    expect(nextTabId).toBe(firstLauncherTabId);
    expect(collectAllTabs(layout.root)).toEqual([
      {
        tabId: firstLauncherTabId!,
        target: { kind: "agent", agentId: "agent-1" },
        createdAt: expect.any(Number),
      },
    ]);
    expect(findPaneById(layout.root, "main")?.focusedTabId).toBe(firstLauncherTabId);
  });

  it("reorderTabs reorders tabs within the focused pane", () => {
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const firstTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const thirdTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/c.ts" });

    store.reorderTabs(workspaceKey, [thirdTabId!, firstTabId!]);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(findPaneById(layout.root, "main")).toEqual({
      id: "main",
      tabIds: [thirdTabId!, firstTabId!, secondTabId!],
      focusedTabId: thirdTabId,
      tabs: [
        {
          tabId: thirdTabId,
          target: { kind: "file", path: "/repo/worktree/c.ts" },
          createdAt: expect.any(Number),
        },
        {
          tabId: firstTabId,
          target: { kind: "file", path: "/repo/worktree/a.ts" },
          createdAt: expect.any(Number),
        },
        {
          tabId: secondTabId,
          target: { kind: "file", path: "/repo/worktree/b.ts" },
          createdAt: expect.any(Number),
        },
      ],
    });
  });

  it("reorderTabsInPane reorders tabs in the requested pane without changing focused pane", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "34343434-3434-3434-3434-343434343434",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const thirdTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/c.ts" });
    const fourthTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/d.ts" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: thirdTabId!,
      targetPaneId: "main",
      position: "right",
    });

    store.moveTabToPane(workspaceKey, fourthTabId!, splitPaneId!);
    store.focusPane(workspaceKey, "main");
    store.reorderTabsInPane(workspaceKey, splitPaneId!, [fourthTabId!, thirdTabId!]);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(splitPaneId).toBe("pane_34343434-3434-3434-3434-343434343434");
    expect(layout.focusedPaneId).toBe("main");
    expect(findPaneById(layout.root, splitPaneId!)).toEqual({
      id: splitPaneId,
      tabIds: [fourthTabId!, thirdTabId!],
      focusedTabId: fourthTabId,
      tabs: [
        {
          tabId: fourthTabId,
          target: { kind: "file", path: "/repo/worktree/d.ts" },
          createdAt: expect.any(Number),
        },
        {
          tabId: thirdTabId,
          target: { kind: "file", path: "/repo/worktree/c.ts" },
          createdAt: expect.any(Number),
        },
      ],
    });
  });

  it("focusPane switches workspace focus to a different pane", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "56565656-5656-5656-5656-565656565656",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: secondTabId!,
      targetPaneId: "main",
      position: "right",
    });

    store.focusPane(workspaceKey, "main");
    let layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    expect(layout.focusedPaneId).toBe("main");

    store.focusPane(workspaceKey, splitPaneId!);
    layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(splitPaneId).toBe("pane_56565656-5656-5656-5656-565656565656");
    expect(layout.focusedPaneId).toBe(splitPaneId);
  });

  it("closeTab collapses an emptied pane and keeps the nearest sibling focused", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: secondTabId!,
      targetPaneId: "main",
      position: "right",
    });

    store.closeTab(workspaceKey, secondTabId!);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(splitPaneId).toBe("pane_cccccccc-cccc-cccc-cccc-cccccccccccc");
    expect(layout.focusedPaneId).toBe("main");
    expect(collectAllPanes(layout.root).map((pane) => pane.id)).toEqual(["main"]);
  });

  it("splitPane enforces the maximum depth of four", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111")
      .mockReturnValueOnce("22222222-2222-2222-2222-222222222222")
      .mockReturnValueOnce("33333333-3333-3333-3333-333333333333")
      .mockReturnValueOnce("44444444-4444-4444-4444-444444444444")
      .mockReturnValueOnce("55555555-5555-5555-5555-555555555555")
      .mockReturnValueOnce("66666666-6666-6666-6666-666666666666")
      .mockReturnValueOnce("77777777-7777-7777-7777-777777777777")
      .mockReturnValueOnce("88888888-8888-8888-8888-888888888888");

    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();
    const a = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const b = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const c = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/c.ts" });
    const d = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/d.ts" });
    const e = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/e.ts" });

    expect(a).toBeTruthy();
    const pane1 = store.splitPane(workspaceKey, {
      tabId: b!,
      targetPaneId: "main",
      position: "right",
    });
    const pane2 = store.splitPane(workspaceKey, {
      tabId: c!,
      targetPaneId: pane1!,
      position: "bottom",
    });
    const pane3 = store.splitPane(workspaceKey, {
      tabId: d!,
      targetPaneId: pane2!,
      position: "right",
    });
    const pane4 = store.splitPane(workspaceKey, {
      tabId: e!,
      targetPaneId: pane3!,
      position: "bottom",
    });

    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    expect(pane1).toBe("pane_11111111-1111-1111-1111-111111111111");
    expect(pane2).toBe("pane_33333333-3333-3333-3333-333333333333");
    expect(pane3).toBe("pane_55555555-5555-5555-5555-555555555555");
    expect(pane4).toBeNull();
    expect(getTreeDepth(layout.root)).toBe(4);
  });

  it("moveTabToPane collapses the source pane when its last tab moves out", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "dddddddd-dddd-dddd-dddd-dddddddddddd",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const leftTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const rightTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: rightTabId!,
      targetPaneId: "main",
      position: "right",
    });

    store.moveTabToPane(workspaceKey, leftTabId!, splitPaneId!);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(layout.focusedPaneId).toBe(splitPaneId);
    expect(collectAllPanes(layout.root).map((pane) => pane.id)).toEqual([splitPaneId!]);
    expect(findPaneById(layout.root, splitPaneId!)?.tabIds).toEqual([
      "file_/repo/worktree/b.ts",
      "file_/repo/worktree/a.ts",
    ]);
  });

  it("closeTab cascades group unwrapping when an inner split collapses to a single pane", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("78787878-7878-7878-7878-787878787878")
      .mockReturnValueOnce("89898989-8989-8989-8989-898989898989")
      .mockReturnValueOnce("9a9a9a9a-9a9a-9a9a-9a9a-9a9a9a9a9a9a");

    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const thirdTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/c.ts" });
    const paneBId = store.splitPane(workspaceKey, {
      tabId: secondTabId!,
      targetPaneId: "main",
      position: "right",
    });
    const paneCId = store.splitPane(workspaceKey, {
      tabId: thirdTabId!,
      targetPaneId: paneBId!,
      position: "bottom",
    });

    store.closeTab(workspaceKey, secondTabId!);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    const rootGroup = expectGroup(layout.root);

    expect(paneBId).toBe("pane_78787878-7878-7878-7878-787878787878");
    expect(paneCId).toBe("pane_9a9a9a9a-9a9a-9a9a-9a9a-9a9a9a9a9a9a");
    expect(layout.focusedPaneId).toBe(paneCId);
    expect(rootGroup.group.direction).toBe("horizontal");
    expect(rootGroup.group.children).toHaveLength(2);
    expect(
      rootGroup.group.children.map((child) => {
        expect(child.kind).toBe("pane");
        if (child.kind !== "pane") {
          throw new Error("Expected pane child");
        }
        return {
          id: child.pane.id,
          tabIds: child.pane.tabIds,
          focusedTabId: child.pane.focusedTabId,
        };
      }),
    ).toEqual([
      {
        id: "main",
        tabIds: ["file_/repo/worktree/a.ts"],
        focusedTabId: "file_/repo/worktree/a.ts",
      },
      {
        id: paneCId!,
        tabIds: ["file_/repo/worktree/c.ts"],
        focusedTabId: "file_/repo/worktree/c.ts",
      },
    ]);
    expect(rootGroup.group.sizes).toEqual([0.5, 0.5]);
  });

  it("openTab focuses the existing tab instead of creating a duplicate entry", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "abababab-abab-abab-abab-abababababab",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const secondTabId = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: secondTabId!,
      targetPaneId: "main",
      position: "right",
    });

    store.focusPane(workspaceKey, "main");
    const duplicateTabId = store.openTab(workspaceKey, {
      kind: "file",
      path: "/repo/worktree/b.ts",
    });
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(splitPaneId).toBe("pane_abababab-abab-abab-abab-abababababab");
    expect(duplicateTabId).toBe(secondTabId);
    expect(layout.focusedPaneId).toBe(splitPaneId);
    expect(collectAllTabs(layout.root).map((tab) => tab.tabId)).toEqual([
      "file_/repo/worktree/a.ts",
      "file_/repo/worktree/b.ts",
    ]);
  });

  it("resizeSplit keeps sizes normalized while enforcing the minimum proportion", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee")
      .mockReturnValueOnce("ffffffff-ffff-ffff-ffff-ffffffffffff")
      .mockReturnValueOnce("11111111-1111-1111-1111-111111111111");

    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const a = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/a.ts" });
    const b = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/b.ts" });
    const c = store.openTab(workspaceKey, { kind: "file", path: "/repo/worktree/c.ts" });

    expect(a).toBeTruthy();
    const rightPaneId = store.splitPane(workspaceKey, {
      tabId: b!,
      targetPaneId: "main",
      position: "right",
    });
    const farRightPaneId = store.splitPane(workspaceKey, {
      tabId: c!,
      targetPaneId: rightPaneId!,
      position: "right",
    });

    const splitRoot = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!.root;
    const splitGroup = expectGroup(splitRoot);
    const nestedGroup = expectGroup(splitGroup.group.children[1]!);
    store.resizeSplit(workspaceKey, nestedGroup.group.id, [0.01, 0.99]);

    const resizedRoot = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!.root;
    const resizedGroup = expectGroup(resizedRoot);
    const resizedNestedGroup = expectGroup(resizedGroup.group.children[1]!);
    const total = resizedNestedGroup.group.sizes.reduce((sum, size) => sum + size, 0);

    expect(rightPaneId).toBe("pane_eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");
    expect(farRightPaneId).toBe("pane_11111111-1111-1111-1111-111111111111");
    expect(resizedNestedGroup.group.sizes[0]).toBeGreaterThanOrEqual(0.1);
    expect(resizedNestedGroup.group.sizes[1]).toBeGreaterThanOrEqual(0.1);
    expect(total).toBeCloseTo(1, 10);
  });

  it("closing the last tab keeps a single empty pane in the layout", () => {
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const tabId = store.openTab(workspaceKey, { kind: "draft", draftId: "draft-1" });
    store.closeTab(workspaceKey, tabId!);
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(layout).toEqual(createDefaultLayout());
  });

  it("keeps pinned archived agents in memory per workspace without persisting them", () => {
    const workspaceKey = createWorkspaceKey();
    const otherWorkspaceKey = buildWorkspaceTabPersistenceKey({
      serverId: SERVER_ID,
      workspaceId: "/repo/other-worktree",
    });

    expect(otherWorkspaceKey).toBeTruthy();

    const store = useWorkspaceLayoutStore.getState();
    store.pinAgent(workspaceKey, "agent-1");
    store.pinAgent(workspaceKey, "agent-1");
    store.pinAgent(otherWorkspaceKey as string, "agent-2");

    let state = useWorkspaceLayoutStore.getState();
    expect(Array.from(state.pinnedAgentIdsByWorkspace[workspaceKey] ?? [])).toEqual(["agent-1"]);
    expect(Array.from(state.pinnedAgentIdsByWorkspace[otherWorkspaceKey as string] ?? [])).toEqual([
      "agent-2",
    ]);

    store.unpinAgent(workspaceKey, "agent-1");

    state = useWorkspaceLayoutStore.getState();
    expect(state.pinnedAgentIdsByWorkspace[workspaceKey]).toBeUndefined();
    expect(Array.from(state.pinnedAgentIdsByWorkspace[otherWorkspaceKey as string] ?? [])).toEqual([
      "agent-2",
    ]);

    const partialize = useWorkspaceLayoutStore.persist.getOptions().partialize;
    expect(partialize).toBeTypeOf("function");
    expect(partialize?.(state)).toEqual({
      layoutByWorkspace: {},
      splitSizesByWorkspace: {},
    });
  });

  it("convertDraftToAgent removes the draft and focuses the existing canonical agent tab", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "67676767-6767-6767-6767-676767676767",
    );
    const workspaceKey = createWorkspaceKey();
    const store = useWorkspaceLayoutStore.getState();

    const draftTabId = store.openTab(workspaceKey, { kind: "draft", draftId: "draft-existing" });
    const agentTabId = store.openTab(workspaceKey, { kind: "agent", agentId: "agent-1" });
    const splitPaneId = store.splitPane(workspaceKey, {
      tabId: agentTabId!,
      targetPaneId: "main",
      position: "right",
    });

    const nextTabId = store.convertDraftToAgent(workspaceKey, draftTabId!, "agent-1");
    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;

    expect(splitPaneId).toBe("pane_67676767-6767-6767-6767-676767676767");
    expect(nextTabId).toBe("agent_agent-1");
    expect(collectAllTabs(layout.root).map((tab) => tab.tabId)).toEqual(["agent_agent-1"]);
    expect(layout.focusedPaneId).toBe(splitPaneId);
    expect(findPaneContainingTab(layout.root, "agent_agent-1")?.id).toBe(splitPaneId);
  });

  it("reconcileTabs canonicalizes duplicates and prunes stale entity tabs from hydrated snapshots", () => {
    const workspaceKey = createWorkspaceKey();

    useWorkspaceLayoutStore.setState((state) => ({
      ...state,
      layoutByWorkspace: {
        ...state.layoutByWorkspace,
        [workspaceKey]: {
          root: {
            kind: "pane",
            pane: {
              id: "main",
              tabIds: ["draft_agent", "agent_agent-1", "terminal_orphan", "draft-1"],
              focusedTabId: "draft_agent",
              tabs: [
                {
                  tabId: "draft_agent",
                  target: { kind: "agent", agentId: "agent-1" },
                  createdAt: 1,
                },
                {
                  tabId: "agent_agent-1",
                  target: { kind: "agent", agentId: "agent-1" },
                  createdAt: 2,
                },
                {
                  tabId: "terminal_orphan",
                  target: { kind: "terminal", terminalId: "term-stale" },
                  createdAt: 3,
                },
                {
                  tabId: "draft-1",
                  target: { kind: "draft", draftId: "draft-1" },
                  createdAt: 4,
                },
              ],
            } as any,
          },
          focusedPaneId: "main",
        },
      },
      pinnedAgentIdsByWorkspace: {
        [workspaceKey]: new Set<string>(["agent-2"]),
      },
    }));

    useWorkspaceLayoutStore.getState().reconcileTabs(workspaceKey, {
      agentsHydrated: true,
      terminalsHydrated: true,
      activeAgentIds: ["agent-1"],
      knownAgentIds: ["agent-1", "agent-2"],
      standaloneTerminalIds: ["term-1"],
      hasActivePendingDraftCreate: false,
    });

    const layout = useWorkspaceLayoutStore.getState().layoutByWorkspace[workspaceKey]!;
    const tabs = collectAllTabs(layout.root);

    expect(tabs.map((tab) => tab.tabId)).toEqual([
      "agent_agent-1",
      "draft-1",
      "agent_agent-2",
      "terminal_term-1",
    ]);
    expect(tabs.find((tab) => tab.tabId === "agent_agent-1")).toEqual({
      tabId: "agent_agent-1",
      target: { kind: "agent", agentId: "agent-1" },
      createdAt: 2,
    });
    expect(layout.focusedPaneId).toBe("main");
    expect(findPaneById(layout.root, "main")?.focusedTabId).toBe("agent_agent-1");
  });
});
