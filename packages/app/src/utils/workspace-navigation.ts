import { router } from "expo-router";
import { useWorkspaceLayoutStore } from "@/stores/workspace-layout-store";
import { generateDraftId } from "@/stores/draft-keys";
import { useTerminalAgentReopenStore } from "@/stores/terminal-agent-reopen-store";
import {
  buildWorkspaceTabPersistenceKey,
  type WorkspaceTabTarget,
} from "@/stores/workspace-tabs-store";
import { buildHostWorkspaceRoute } from "@/utils/host-routes";

interface PrepareWorkspaceTabInput {
  serverId: string;
  workspaceId: string;
  target: WorkspaceTabTarget;
  pin?: boolean;
  requestReopen?: boolean;
}

interface NavigateToPreparedWorkspaceTabInput extends PrepareWorkspaceTabInput {
  navigationMethod?: "navigate" | "replace";
}

function getPreparedTarget(target: WorkspaceTabTarget): WorkspaceTabTarget {
  if (target.kind !== "draft" || target.draftId.trim() !== "new") {
    return target;
  }
  return { kind: "draft", draftId: generateDraftId() };
}

export function prepareWorkspaceTab(input: PrepareWorkspaceTabInput): string {
  const target = getPreparedTarget(input.target);
  const key =
    buildWorkspaceTabPersistenceKey({
      serverId: input.serverId,
      workspaceId: input.workspaceId,
    }) ?? "";

  const tabId = useWorkspaceLayoutStore.getState().openTab(key, target);

  if (tabId) {
    useWorkspaceLayoutStore.getState().focusTab(key, tabId);
  }

  if (input.pin && target.kind === "agent") {
    useWorkspaceLayoutStore.getState().pinAgent(key, target.agentId);
  }

  if (input.requestReopen && target.kind === "agent") {
    useTerminalAgentReopenStore.getState().requestReopen({
      serverId: input.serverId,
      agentId: target.agentId,
    });
  }

  return buildHostWorkspaceRoute(input.serverId, input.workspaceId);
}

export function navigateToPreparedWorkspaceTab(input: NavigateToPreparedWorkspaceTabInput): string {
  const route = prepareWorkspaceTab(input);
  if (input.navigationMethod === "replace") {
    router.replace(route as any);
  } else {
    router.navigate(route as any);
  }
  return route;
}
