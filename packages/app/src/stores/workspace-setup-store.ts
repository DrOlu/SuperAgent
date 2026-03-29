import { create } from "zustand";

export type WorkspaceSetupNavigationMethod = "navigate" | "replace";
export type WorkspaceCreationMethod = "open_project" | "create_worktree";

export interface PendingWorkspaceSetup {
  serverId: string;
  projectPath: string;
  projectName?: string;
  creationMethod: WorkspaceCreationMethod;
  navigationMethod: WorkspaceSetupNavigationMethod;
}

interface WorkspaceSetupStoreState {
  pendingWorkspaceSetup: PendingWorkspaceSetup | null;
  beginWorkspaceSetup: (value: PendingWorkspaceSetup) => void;
  clearWorkspaceSetup: () => void;
}

export const useWorkspaceSetupStore = create<WorkspaceSetupStoreState>()((set) => ({
  pendingWorkspaceSetup: null,
  beginWorkspaceSetup: (value) => {
    set({ pendingWorkspaceSetup: value });
  },
  clearWorkspaceSetup: () => {
    set({ pendingWorkspaceSetup: null });
  },
}));
