import type {
  AgentClient,
  AgentModelDefinition,
  AgentProvider,
  ListModelsOptions,
} from "./agent-sdk-types.js";
import type { AgentProviderRuntimeSettingsMap } from "./provider-launch-config.js";
import type { Logger } from "pino";

import { ClaudeAgentClient } from "./providers/claude-agent.js";
import { CodexAppServerAgentClient } from "./providers/codex-app-server-agent.js";
import { GeminiAgentClient } from "./providers/gemini-agent.js";
import { AmpAgentClient } from "./providers/amp-agent.js";
import { AiderAgentClient } from "./providers/aider-agent.js";
import { OpenCodeAgentClient, OpenCodeServerManager } from "./providers/opencode-agent.js";

import {
  AGENT_PROVIDER_DEFINITIONS,
  getAgentProviderDefinition,
  type AgentProviderDefinition,
} from "./provider-manifest.js";

export type { AgentProviderDefinition };

export { AGENT_PROVIDER_DEFINITIONS, getAgentProviderDefinition };

export interface ProviderDefinition extends AgentProviderDefinition {
  createClient: (logger: Logger) => AgentClient;
  fetchModels: (options?: ListModelsOptions) => Promise<AgentModelDefinition[]>;
}

type BuildProviderRegistryOptions = {
  runtimeSettings?: AgentProviderRuntimeSettingsMap;
};

export function buildProviderRegistry(
  logger: Logger,
  options?: BuildProviderRegistryOptions,
): Record<AgentProvider, ProviderDefinition> {
  const runtimeSettings = options?.runtimeSettings;
  const claudeClient = new ClaudeAgentClient({
    logger,
    runtimeSettings: runtimeSettings?.claude,
  });
  const codexClient = new CodexAppServerAgentClient(logger, runtimeSettings?.codex);
  const geminiClient = new GeminiAgentClient(runtimeSettings?.gemini);
  const ampClient = new AmpAgentClient(runtimeSettings?.amp);
  const aiderClient = new AiderAgentClient(runtimeSettings?.aider);
  const opencodeClient = new OpenCodeAgentClient(logger, runtimeSettings?.opencode);

  return {
    claude: {
      ...AGENT_PROVIDER_DEFINITIONS.find((d) => d.id === "claude")!,
      createClient: (logger: Logger) =>
        new ClaudeAgentClient({ logger, runtimeSettings: runtimeSettings?.claude }),
      fetchModels: (options) => claudeClient.listModels(options),
    },
    codex: {
      ...AGENT_PROVIDER_DEFINITIONS.find((d) => d.id === "codex")!,
      createClient: (logger: Logger) =>
        new CodexAppServerAgentClient(logger, runtimeSettings?.codex),
      fetchModels: (options) => codexClient.listModels(options),
    },
    gemini: {
      ...AGENT_PROVIDER_DEFINITIONS.find((d) => d.id === "gemini")!,
      createClient: () => new GeminiAgentClient(runtimeSettings?.gemini),
      fetchModels: (options) => geminiClient.listModels(options),
    },
    amp: {
      ...AGENT_PROVIDER_DEFINITIONS.find((d) => d.id === "amp")!,
      createClient: () => new AmpAgentClient(runtimeSettings?.amp),
      fetchModels: (options) => ampClient.listModels(options),
    },
    aider: {
      ...AGENT_PROVIDER_DEFINITIONS.find((d) => d.id === "aider")!,
      createClient: () => new AiderAgentClient(runtimeSettings?.aider),
      fetchModels: (options) => aiderClient.listModels(options),
    },
    opencode: {
      ...AGENT_PROVIDER_DEFINITIONS.find((d) => d.id === "opencode")!,
      createClient: (logger: Logger) => new OpenCodeAgentClient(logger, runtimeSettings?.opencode),
      fetchModels: (options) => opencodeClient.listModels(options),
    },
  };
}

// Deprecated: Use buildProviderRegistry instead
export const PROVIDER_REGISTRY: Record<AgentProvider, ProviderDefinition> = null as any;

export function createAllClients(
  logger: Logger,
  options?: BuildProviderRegistryOptions,
): Record<AgentProvider, AgentClient> {
  const registry = buildProviderRegistry(logger, options);
  return {
    claude: registry.claude.createClient(logger),
    codex: registry.codex.createClient(logger),
    gemini: registry.gemini.createClient(logger),
    amp: registry.amp.createClient(logger),
    aider: registry.aider.createClient(logger),
    opencode: registry.opencode.createClient(logger),
  };
}

export async function shutdownProviders(
  logger: Logger,
  options?: BuildProviderRegistryOptions,
): Promise<void> {
  await OpenCodeServerManager.getInstance(logger, options?.runtimeSettings?.opencode).shutdown();
}
