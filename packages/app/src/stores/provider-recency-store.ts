import { useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AgentProvider } from "@server/server/agent/agent-sdk-types";
import {
  AGENT_PROVIDER_DEFINITIONS,
  isValidAgentProvider,
  type AgentProviderDefinition,
} from "@server/server/agent/provider-manifest";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const PROVIDER_RECENCY_STORE_VERSION = 1;

interface ProviderRecencyStoreState {
  recentProviderIds: AgentProvider[];
  recordUsage: (providerId: AgentProvider) => void;
}

function sanitizeRecentProviderIds(providerIds: readonly string[] | undefined): AgentProvider[] {
  if (!providerIds || providerIds.length === 0) {
    return [];
  }

  const seen = new Set<AgentProvider>();
  const sanitized: AgentProvider[] = [];
  for (const providerId of providerIds) {
    if (!isValidAgentProvider(providerId)) {
      continue;
    }
    if (seen.has(providerId)) {
      continue;
    }
    seen.add(providerId);
    sanitized.push(providerId);
  }
  return sanitized;
}

export function sortProvidersByRecency<T extends { id: string }>(
  providers: readonly T[],
  recentProviderIds: readonly string[],
): T[] {
  if (providers.length <= 1) {
    return [...providers];
  }

  const recentRank = new Map<string, number>();
  for (const providerId of recentProviderIds) {
    if (recentRank.has(providerId)) {
      continue;
    }
    recentRank.set(providerId, recentRank.size);
  }

  return providers
    .map((provider, defaultIndex) => ({
      provider,
      defaultIndex,
      recentIndex: recentRank.get(provider.id) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => {
      if (left.recentIndex !== right.recentIndex) {
        return left.recentIndex - right.recentIndex;
      }
      return left.defaultIndex - right.defaultIndex;
    })
    .map((entry) => entry.provider);
}

function migratePersistedState(state: unknown): Pick<ProviderRecencyStoreState, "recentProviderIds"> {
  const record = state as { recentProviderIds?: string[] } | null | undefined;
  return {
    recentProviderIds: sanitizeRecentProviderIds(record?.recentProviderIds),
  };
}

export const useProviderRecencyStore = create<ProviderRecencyStoreState>()(
  persist(
    (set) => ({
      recentProviderIds: [],
      recordUsage: (providerId) => {
        if (!isValidAgentProvider(providerId)) {
          return;
        }

        set((state) => ({
          recentProviderIds: [
            providerId,
            ...state.recentProviderIds.filter((id) => id !== providerId),
          ],
        }));
      },
    }),
    {
      name: "terminal-agent-provider-recency",
      version: PROVIDER_RECENCY_STORE_VERSION,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentProviderIds: state.recentProviderIds,
      }),
      migrate: (persistedState) => migratePersistedState(persistedState),
    },
  ),
);

export function useProviderRecency(
  availableProviders: readonly AgentProviderDefinition[] = AGENT_PROVIDER_DEFINITIONS,
): {
  providers: AgentProviderDefinition[];
  recordUsage: (providerId: AgentProvider) => void;
} {
  const recentProviderIds = useProviderRecencyStore((state) => state.recentProviderIds);
  const recordUsage = useProviderRecencyStore((state) => state.recordUsage);

  const providers = useMemo(
    () => sortProvidersByRecency(availableProviders, recentProviderIds),
    [availableProviders, recentProviderIds],
  );

  return {
    providers,
    recordUsage,
  };
}

export const __providerRecencyStoreTestUtils = {
  migratePersistedState,
  sanitizeRecentProviderIds,
};
