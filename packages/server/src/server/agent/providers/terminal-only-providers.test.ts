import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { AgentSessionConfig } from "../agent-sdk-types.js";
import { AiderAgentClient } from "./aider-agent.js";
import { AmpAgentClient } from "./amp-agent.js";
import { GeminiAgentClient } from "./gemini-agent.js";

function createExecutable(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "terminal-provider-test-"));
  const file = path.join(dir, "provider-bin");
  writeFileSync(file, "#!/bin/sh\nexit 0\n");
  chmodSync(file, 0o755);
  return file;
}

const buildConfig = (provider: "gemini" | "amp" | "aider"): AgentSessionConfig => ({
  provider,
  cwd: "/tmp/worktree",
  terminal: true,
});

describe("terminal-only providers", () => {
  test("Gemini builds an interactive prompt command without injecting cwd flags", () => {
    const executable = createExecutable();
    try {
      const client = new GeminiAgentClient({
        command: { mode: "replace", argv: [executable] },
      });

      const command = client.buildTerminalCreateCommand(
        buildConfig("gemini"),
        { provider: "gemini", sessionId: "session-1" },
        "Fix the bug",
      );

      expect(command.command).toBe(executable);
      expect(command.args).toEqual(["-i", "Fix the bug"]);
    } finally {
      rmSync(path.dirname(executable), { recursive: true, force: true });
    }
  });

  test("AMP launches without unsupported cwd flags", () => {
    const executable = createExecutable();
    try {
      const client = new AmpAgentClient({
        command: { mode: "replace", argv: [executable] },
      });

      const command = client.buildTerminalCreateCommand(buildConfig("amp"), {
        provider: "amp",
        sessionId: "session-1",
      });

      expect(command.command).toBe(executable);
      expect(command.args).toEqual([]);
    } finally {
      rmSync(path.dirname(executable), { recursive: true, force: true });
    }
  });

  test("Aider does not treat initial prompts as positional CLI arguments", () => {
    const executable = createExecutable();
    try {
      const client = new AiderAgentClient({
        command: { mode: "replace", argv: [executable] },
      });

      const command = client.buildTerminalCreateCommand(
        buildConfig("aider"),
        { provider: "aider", sessionId: "session-1" },
        "Refactor the parser",
      );

      expect(command.command).toBe(executable);
      expect(command.args).toEqual(["--no-auto-commits"]);
    } finally {
      rmSync(path.dirname(executable), { recursive: true, force: true });
    }
  });

  test("provider availability respects missing replacement binaries", async () => {
    const missingPath = path.join(os.tmpdir(), "missing-terminal-provider");

    await expect(
      new GeminiAgentClient({
        command: { mode: "replace", argv: [missingPath] },
      }).isAvailable(),
    ).resolves.toBe(false);
    await expect(
      new AmpAgentClient({
        command: { mode: "replace", argv: [missingPath] },
      }).isAvailable(),
    ).resolves.toBe(false);
    await expect(
      new AiderAgentClient({
        command: { mode: "replace", argv: [missingPath] },
      }).isAvailable(),
    ).resolves.toBe(false);
  });
});
