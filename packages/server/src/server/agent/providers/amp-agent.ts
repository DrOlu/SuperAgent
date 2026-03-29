import { existsSync } from "node:fs";

import type {
  AgentCapabilityFlags,
  AgentClient,
  AgentLaunchContext,
  AgentModelDefinition,
  AgentPersistenceHandle,
  AgentSession,
  AgentSessionConfig,
  ListModelsOptions,
  TerminalCommand,
} from "../agent-sdk-types.js";
import {
  applyProviderEnv,
  findExecutable,
  isProviderCommandAvailable,
  resolveProviderCommandPrefix,
  sanitizeTerminalEnv,
  type ProviderRuntimeSettings,
} from "../provider-launch-config.js";

const AMP_PROVIDER = "amp" as const;

const AMP_CAPABILITIES: AgentCapabilityFlags = {
  supportsStreaming: false,
  supportsSessionPersistence: false,
  supportsDynamicModes: false,
  supportsMcpServers: false,
  supportsReasoningStream: false,
  supportsToolInvocations: false,
  supportsTerminalMode: true,
};

type AmpAgentConfig = AgentSessionConfig & { provider: "amp" };

function resolveAmpBinary(): string {
  const found = findExecutable("amp");
  if (found) {
    return found;
  }
  throw new Error(
    "AMP binary not found. Install AMP and ensure 'amp' is available in your shell PATH.",
  );
}

function createUnsupportedSessionError(): Error {
  return new Error("AMP currently supports terminal mode only in Paseo.");
}

export class AmpAgentClient implements AgentClient {
  readonly provider = AMP_PROVIDER;
  readonly capabilities = AMP_CAPABILITIES;

  constructor(private readonly runtimeSettings?: ProviderRuntimeSettings) {}

  async createSession(
    _config: AgentSessionConfig,
    _launchContext?: AgentLaunchContext,
  ): Promise<AgentSession> {
    throw createUnsupportedSessionError();
  }

  async resumeSession(
    _handle: AgentPersistenceHandle,
    _overrides?: Partial<AgentSessionConfig>,
    _launchContext?: AgentLaunchContext,
  ): Promise<AgentSession> {
    throw createUnsupportedSessionError();
  }

  async listModels(_options?: ListModelsOptions): Promise<AgentModelDefinition[]> {
    return [];
  }

  buildTerminalCreateCommand(
    config: AgentSessionConfig,
    _handle: AgentPersistenceHandle,
    _initialPrompt?: string,
  ): TerminalCommand {
    this.assertConfig(config);
    const launchPrefix = resolveProviderCommandPrefix(
      this.runtimeSettings?.command,
      resolveAmpBinary,
    );
    const terminalEnv = sanitizeTerminalEnv(
      applyProviderEnv(process.env as Record<string, string | undefined>, this.runtimeSettings),
    );
    return {
      command: launchPrefix.command,
      args: [...launchPrefix.args],
      env: terminalEnv,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (this.runtimeSettings?.command?.mode === "replace") {
      return existsSync(this.runtimeSettings.command.argv[0]);
    }
    return isProviderCommandAvailable(this.runtimeSettings?.command, resolveAmpBinary);
  }

  private assertConfig(config: AgentSessionConfig): AmpAgentConfig {
    if (config.provider !== AMP_PROVIDER) {
      throw new Error(`AmpAgentClient received config for provider '${config.provider}'`);
    }
    return { ...config, provider: AMP_PROVIDER };
  }
}
