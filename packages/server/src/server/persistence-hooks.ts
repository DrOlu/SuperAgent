import type pino from "pino";

import type { AgentSessionConfig } from "./agent/agent-sdk-types.js";
import type { StoredAgentRecord } from "./agent/agent-storage.js";
import { isValidAgentProvider } from "./agent/provider-manifest.js";

export function buildConfigOverrides(record: StoredAgentRecord): Partial<AgentSessionConfig> {
  return {
    cwd: record.cwd,
    terminal: record.config?.terminal ?? undefined,
    modeId: record.lastModeId ?? record.config?.modeId ?? undefined,
    model: record.config?.model ?? undefined,
    thinkingOptionId: record.config?.thinkingOptionId ?? undefined,
    title: record.config?.title ?? undefined,
    extra: record.config?.extra ?? undefined,
    systemPrompt: record.config?.systemPrompt ?? undefined,
    mcpServers: record.config?.mcpServers ?? undefined,
  };
}

export function buildSessionConfig(record: StoredAgentRecord): AgentSessionConfig {
  if (!isValidAgentProvider(record.provider)) {
    throw new Error(`Unknown provider '${record.provider}'`);
  }
  const overrides = buildConfigOverrides(record);
  return {
    provider: record.provider,
    cwd: record.cwd,
    terminal: overrides.terminal,
    modeId: overrides.modeId,
    model: overrides.model,
    thinkingOptionId: overrides.thinkingOptionId,
    title: overrides.title,
    extra: overrides.extra,
    systemPrompt: overrides.systemPrompt,
    mcpServers: overrides.mcpServers,
  };
}

export function toAgentPersistenceHandle(
  logger: pino.Logger,
  handle: StoredAgentRecord["persistence"],
) {
  if (!handle) {
    return null;
  }
  const provider = handle.provider;
  if (!isValidAgentProvider(provider)) {
    logger.warn({ provider }, `Ignoring persistence handle with unknown provider '${provider}'`);
    return null;
  }
  if (!handle.sessionId) {
    logger.warn("Ignoring persistence handle missing sessionId");
    return null;
  }
  return {
    provider,
    sessionId: handle.sessionId,
    nativeHandle: handle.nativeHandle,
    metadata: handle.metadata,
  };
}

export function extractTimestamps(record: StoredAgentRecord): {
  createdAt: Date;
  updatedAt: Date;
  lastUserMessageAt: Date | null;
  labels?: Record<string, string>;
} {
  return {
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.lastActivityAt ?? record.updatedAt),
    lastUserMessageAt: record.lastUserMessageAt ? new Date(record.lastUserMessageAt) : null,
    labels: record.labels,
  };
}
