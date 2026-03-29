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

const AIDER_PROVIDER = "aider" as const;

const AIDER_CAPABILITIES: AgentCapabilityFlags = {
  supportsStreaming: false,
  supportsSessionPersistence: false,
  supportsDynamicModes: false,
  supportsMcpServers: false,
  supportsReasoningStream: false,
  supportsToolInvocations: false,
  supportsTerminalMode: true,
};

type AiderAgentConfig = AgentSessionConfig & { provider: "aider" };

function resolveAiderBinary(): string {
  const found = findExecutable("aider");
  if (found) {
    return found;
  }
  throw new Error(
    "Aider binary not found. Install Aider and ensure 'aider' is available in your shell PATH.",
  );
}

function createUnsupportedSessionError(): Error {
  return new Error("Aider currently supports terminal mode only in Paseo.");
}

export class AiderAgentClient implements AgentClient {
  readonly provider = AIDER_PROVIDER;
  readonly capabilities = AIDER_CAPABILITIES;

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
      resolveAiderBinary,
    );
    const terminalEnv = sanitizeTerminalEnv(
      applyProviderEnv(process.env as Record<string, string | undefined>, this.runtimeSettings),
    );
    return {
      command: launchPrefix.command,
      // Aider uses positional arguments for file paths, not interactive prompts.
      args: [...launchPrefix.args, "--no-auto-commits"],
      env: terminalEnv,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (this.runtimeSettings?.command?.mode === "replace") {
      return existsSync(this.runtimeSettings.command.argv[0]);
    }
    return isProviderCommandAvailable(this.runtimeSettings?.command, resolveAiderBinary);
  }

  private assertConfig(config: AgentSessionConfig): AiderAgentConfig {
    if (config.provider !== AIDER_PROVIDER) {
      throw new Error(`AiderAgentClient received config for provider '${config.provider}'`);
    }
    return { ...config, provider: AIDER_PROVIDER };
  }
}
