import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  AgentFeature,
  AgentProvider,
  AgentSessionConfig,
} from "@server/server/agent/agent-sdk-types";
import { useHostRuntimeClient, useHostRuntimeIsConnected } from "@/runtime/host-runtime";

function pruneFeatureValues(
  featureValues: Record<string, unknown>,
  features: AgentFeature[],
): Record<string, unknown> {
  const allowedFeatureIds = new Set(features.map((feature) => feature.id));
  let changed = false;
  const next: Record<string, unknown> = {};

  for (const [featureId, value] of Object.entries(featureValues)) {
    if (!allowedFeatureIds.has(featureId)) {
      changed = true;
      continue;
    }
    next[featureId] = value;
  }

  return changed ? next : featureValues;
}

function applyFeatureValues(
  features: AgentFeature[],
  featureValues: Record<string, unknown>,
): AgentFeature[] {
  if (Object.keys(featureValues).length === 0) {
    return features;
  }

  return features.map((feature) => {
    if (!Object.prototype.hasOwnProperty.call(featureValues, feature.id)) {
      return feature;
    }

    return {
      ...feature,
      value: featureValues[feature.id],
    } as AgentFeature;
  });
}

type DraftFeatureConfig = Pick<
  AgentSessionConfig,
  "provider" | "cwd" | "modeId" | "model" | "thinkingOptionId"
>;

export function useDraftAgentFeatures(input: {
  serverId: string | null | undefined;
  provider: AgentProvider;
  cwd: string | null | undefined;
  modeId: string | null | undefined;
  modelId: string | null | undefined;
  thinkingOptionId: string | null | undefined;
}) {
  const { serverId, provider, cwd, modeId, modelId, thinkingOptionId } = input;
  const [featureValues, setFeatureValues] = useState<Record<string, unknown>>({});
  const client = useHostRuntimeClient(serverId ?? "");
  const isConnected = useHostRuntimeIsConnected(serverId ?? "");
  const normalizedCwd = cwd?.trim() || "";

  const draftConfig = useMemo<DraftFeatureConfig | null>(() => {
    if (!normalizedCwd) {
      return null;
    }

    return {
      provider,
      cwd: normalizedCwd,
      ...(modeId ? { modeId } : {}),
      ...(modelId ? { model: modelId } : {}),
      ...(thinkingOptionId ? { thinkingOptionId } : {}),
    };
  }, [modeId, modelId, normalizedCwd, provider, thinkingOptionId]);

  const featuresQuery = useQuery({
    queryKey: [
      "providerFeatures",
      serverId ?? null,
      provider,
      normalizedCwd || null,
      modeId ?? null,
      modelId ?? null,
      thinkingOptionId ?? null,
    ],
    enabled: Boolean(serverId && client && isConnected && draftConfig),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!client || !draftConfig) {
        throw new Error("Host is not connected");
      }
      const payload = await client.listProviderFeatures(draftConfig);
      if (payload.error) {
        throw new Error(payload.error);
      }
      return payload.features ?? [];
    },
  });

  const features = useMemo(() => {
    return applyFeatureValues(featuresQuery.data ?? [], featureValues);
  }, [featureValues, featuresQuery.data]);

  useEffect(() => {
    const next = pruneFeatureValues(featureValues, features);
    if (next !== featureValues) {
      setFeatureValues(next);
    }
  }, [featureValues, features]);

  const effectiveFeatureValues = Object.keys(featureValues).length > 0 ? featureValues : undefined;
  const setFeatureValue = useCallback((featureId: string, value: unknown) => {
    setFeatureValues((current) => {
      if (Object.is(current[featureId], value)) {
        return current;
      }

      return { ...current, [featureId]: value };
    });
  }, []);

  return {
    features,
    featureValues: effectiveFeatureValues,
    isLoading: featuresQuery.isLoading,
    setFeatureValue,
  };
}
