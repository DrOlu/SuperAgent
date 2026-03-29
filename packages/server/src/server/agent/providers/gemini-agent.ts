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

const GEMINI_PROVIDER = "gemini" as const;

const GEMINI_CAPABILITIES: AgentCapabilityFlags = {
  supportsStreaming: false,
  supportsSessionPersistence: false,
  supportsDynamicModes: false,
  supportsMcpServers: false,
  supportsReasoningStream: false,
  supportsToolInvocations: false,
  supportsTerminalMode: true,
};

type GeminiAgentConfig = AgentSessionConfig & { provider: "gemini" };

function resolveGeminiBinary(): string {
  const found = findExecutable("gemini");
  if (found) {
    return found;
  }
  throw new Error(
    "Gemini CLI binary not found. Install Gemini CLI and ensure 'gemini' is available in your shell PATH.",
  );
}

function createUnsupportedSessionError(): Error {
  return new Error("Gemini CLI currently supports terminal mode only in Paseo.");
}

export class GeminiAgentClient implements AgentClient {
  readonly provider = GEMINI_PROVIDER;
  readonly capabilities = GEMINI_CAPABILITIES;

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
    initialPrompt?: string,
  ): TerminalCommand {
    this.assertConfig(config);
    const launchPrefix = resolveProviderCommandPrefix(
      this.runtimeSettings?.command,
      resolveGeminiBinary,
    );
    const terminalEnv = sanitizeTerminalEnv(
      applyProviderEnv(process.env as Record<string, string | undefined>, this.runtimeSettings),
    );
    const args = [...launchPrefix.args];
    if (initialPrompt?.trim()) {
      args.push("-i", initialPrompt.trim());
    }
    return {
      command: launchPrefix.command,
      args,
      env: terminalEnv,
    };
  }

  buildTerminalResumeCommand(_handle: AgentPersistenceHandle): TerminalCommand {
    const launchPrefix = resolveProviderCommandPrefix(
      this.runtimeSettings?.command,
      resolveGeminiBinary,
    );
    const terminalEnv = sanitizeTerminalEnv(
      applyProviderEnv(process.env as Record<string, string | undefined>, this.runtimeSettings),
    );
    return {
      command: launchPrefix.command,
      args: [...launchPrefix.args, "--resume"],
      env: terminalEnv,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (this.runtimeSettings?.command?.mode === "replace") {
      return existsSync(this.runtimeSettings.command.argv[0]);
    }
    return isProviderCommandAvailable(this.runtimeSettings?.command, resolveGeminiBinary);
  }

  private assertConfig(config: AgentSessionConfig): GeminiAgentConfig {
    if (config.provider !== GEMINI_PROVIDER) {
      throw new Error(`GeminiAgentClient received config for provider '${config.provider}'`);
    }
    return { ...config, provider: GEMINI_PROVIDER };
  }
}
