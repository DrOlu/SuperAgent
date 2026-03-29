import { create } from "zustand";

interface BuildTerminalAgentReopenKeyInput {
  serverId: string;
  agentId: string;
}

interface RequestTerminalAgentReopenInput {
  serverId: string;
  agentId: string;
}

interface TerminalAgentReopenStore {
  reopenIntentVersionByAgentKey: Record<string, number>;
  requestReopen: (input: RequestTerminalAgentReopenInput) => void;
}

function trimNonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildTerminalAgentReopenKey(
  input: BuildTerminalAgentReopenKeyInput,
): string | null {
  const serverId = trimNonEmpty(input.serverId);
  const agentId = trimNonEmpty(input.agentId);
  if (!serverId || !agentId) {
    return null;
  }
  return `${serverId}:${agentId}`;
}

export const useTerminalAgentReopenStore = create<TerminalAgentReopenStore>()((set) => ({
  reopenIntentVersionByAgentKey: {},
  requestReopen: ({ serverId, agentId }) => {
    const key = buildTerminalAgentReopenKey({ serverId, agentId });
    if (!key) {
      return;
    }

    set((state) => ({
      reopenIntentVersionByAgentKey: {
        ...state.reopenIntentVersionByAgentKey,
        [key]: (state.reopenIntentVersionByAgentKey[key] ?? 0) + 1,
      },
    }));
  },
}));
