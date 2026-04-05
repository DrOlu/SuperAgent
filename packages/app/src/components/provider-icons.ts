import { Bot } from "lucide-react-native";
import { AiderIcon } from "@/components/icons/aider-icon";
import { AmpIcon } from "@/components/icons/amp-icon";
import { ClaudeIcon } from "@/components/icons/claude-icon";
import { CodexIcon } from "@/components/icons/codex-icon";
import { GeminiIcon } from "@/components/icons/gemini-icon";
import { CopilotIcon } from "@/components/icons/copilot-icon";
import { OpenCodeIcon } from "@/components/icons/opencode-icon";
import { PiIcon } from "@/components/icons/pi-icon";

const PROVIDER_ICONS: Record<string, typeof Bot> = {
  claude: ClaudeIcon as unknown as typeof Bot,
  codex: CodexIcon as unknown as typeof Bot,
  gemini: GeminiIcon as unknown as typeof Bot,
  amp: AmpIcon as unknown as typeof Bot,
  aider: AiderIcon as unknown as typeof Bot,
  copilot: CopilotIcon as unknown as typeof Bot,
  opencode: OpenCodeIcon as unknown as typeof Bot,
  pi: PiIcon as unknown as typeof Bot,
};

export function getProviderIcon(provider: string): typeof Bot {
  return PROVIDER_ICONS[provider] ?? Bot;
}
