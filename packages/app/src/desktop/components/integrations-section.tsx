import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ArrowUpRight, Terminal, Blocks, Check, RefreshCw, Download } from "lucide-react-native";
import { settingsStyles } from "@/styles/settings";
import { Button } from "@/components/ui/button";
import { openExternalUrl } from "@/utils/open-external-url";
import {
  shouldUseDesktopDaemon,
  getCliInstallStatus,
  installCli,
  getSkillsInstallStatus,
  installSkills,
  getOpencodeStatus,
  installOpencode,
  getPiStatus,
  installPi,
  getUvStatus,
  installUv,
  type InstallStatus,
  type ToolStatus,
} from "@/desktop/daemon/desktop-daemon";

const CLI_DOCS_URL = "https://hyperspace.ng/docs/cli";
const SKILLS_DOCS_URL = "https://hyperspace.ng/docs/skills";
const OPENCODE_URL = "https://github.com/anomalyco/opencode";
const PI_URL = "https://github.com/badlogic/pi-mono";
const UV_URL = "https://github.com/astral-sh/uv";

export function IntegrationsSection() {
  const { theme } = useUnistyles();
  const showSection = shouldUseDesktopDaemon();

  const [cliStatus, setCliStatus] = useState<InstallStatus | null>(null);
  const [skillsStatus, setSkillsStatus] = useState<InstallStatus | null>(null);
  const [opencodeStatus, setOpencodeStatus] = useState<ToolStatus | null>(null);
  const [piStatus, setPiStatus] = useState<ToolStatus | null>(null);
  const [uvStatus, setUvStatus] = useState<ToolStatus | null>(null);

  const [isInstallingCli, setIsInstallingCli] = useState(false);
  const [isInstallingSkills, setIsInstallingSkills] = useState(false);
  const [isInstallingOpencode, setIsInstallingOpencode] = useState(false);
  const [isInstallingPi, setIsInstallingPi] = useState(false);
  const [isInstallingUv, setIsInstallingUv] = useState(false);

  const loadStatus = useCallback(() => {
    if (!showSection) return;
    void getCliInstallStatus().then(setCliStatus).catch(console.error);
    void getSkillsInstallStatus().then(setSkillsStatus).catch(console.error);
    void getOpencodeStatus().then(setOpencodeStatus).catch(console.error);
    void getPiStatus().then(setPiStatus).catch(console.error);
    void getUvStatus().then(setUvStatus).catch(console.error);
  }, [showSection]);

  useFocusEffect(
    useCallback(() => {
      if (!showSection) return undefined;
      loadStatus();
      return undefined;
    }, [loadStatus, showSection]),
  );

  const makeInstallHandler = <T,>(
    setter: (v: T) => void,
    activeSetter: (v: boolean) => void,
    action: () => Promise<T>,
  ) => () => {
    activeSetter(true);
    void action()
      .then(setter)
      .catch((err: unknown) => console.error("[Integrations] Install failed", err))
      .finally(() => activeSetter(false));
  };

  if (!showSection) return null;

  return (
    <View style={settingsStyles.section}>
      <View style={settingsStyles.sectionHeader}>
        <Text style={settingsStyles.sectionHeaderTitle}>Integrations</Text>
        <View style={styles.headerLinks}>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowUpRight size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />}
            textStyle={settingsStyles.sectionHeaderLinkText}
            style={settingsStyles.sectionHeaderLink}
            onPress={() => void openExternalUrl(CLI_DOCS_URL)}
            accessibilityLabel="Open CLI documentation"
          >
            CLI docs
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowUpRight size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />}
            textStyle={settingsStyles.sectionHeaderLinkText}
            style={settingsStyles.sectionHeaderLink}
            onPress={() => void openExternalUrl(SKILLS_DOCS_URL)}
            accessibilityLabel="Open skills documentation"
          >
            Skills docs
          </Button>
        </View>
      </View>

      <View style={settingsStyles.card}>
        {/* SuperAgent CLI */}
        <ToolRow
          icon={<Terminal size={theme.iconSize.md} color={theme.colors.foreground} />}
          title="Command line"
          hint="Control and script agents from your terminal."
          installed={cliStatus?.installed ?? false}
          version={null}
          latestVersion={null}
          hasUpdate={false}
          isInstalling={isInstallingCli}
          onInstall={makeInstallHandler(setCliStatus, setIsInstallingCli, installCli)}
          docsUrl={CLI_DOCS_URL}
          theme={theme}
        />

        {/* Orchestration Skills */}
        <ToolRow
          icon={<Blocks size={theme.iconSize.md} color={theme.colors.foreground} />}
          title="Orchestration skills"
          hint="Teach your agents to orchestrate through the CLI."
          installed={skillsStatus?.installed ?? false}
          version={null}
          latestVersion={null}
          hasUpdate={false}
          isInstalling={isInstallingSkills}
          onInstall={makeInstallHandler(setSkillsStatus, setIsInstallingSkills, installSkills)}
          docsUrl={SKILLS_DOCS_URL}
          theme={theme}
          border
        />

        {/* opencode */}
        <ToolRow
          icon={<Terminal size={theme.iconSize.md} color={theme.colors.foreground} />}
          title="opencode"
          hint="OpenCode AI coding agent."
          installed={opencodeStatus?.installed ?? false}
          version={opencodeStatus?.version ?? null}
          latestVersion={opencodeStatus?.latestVersion ?? null}
          hasUpdate={opencodeStatus?.hasUpdate ?? false}
          isInstalling={isInstallingOpencode}
          onInstall={makeInstallHandler(setOpencodeStatus, setIsInstallingOpencode, installOpencode)}
          docsUrl={OPENCODE_URL}
          theme={theme}
          border
        />

        {/* Pi */}
        <ToolRow
          icon={<Terminal size={theme.iconSize.md} color={theme.colors.foreground} />}
          title="Pi"
          hint="Pi AI agent by Mario Zechner."
          installed={piStatus?.installed ?? false}
          version={piStatus?.version ?? null}
          latestVersion={piStatus?.latestVersion ?? null}
          hasUpdate={piStatus?.hasUpdate ?? false}
          isInstalling={isInstallingPi}
          onInstall={makeInstallHandler(setPiStatus, setIsInstallingPi, installPi)}
          docsUrl={PI_URL}
          theme={theme}
          border
        />

        {/* uv / uvx */}
        <ToolRow
          icon={<Terminal size={theme.iconSize.md} color={theme.colors.foreground} />}
          title="uv / uvx"
          hint="Fast Python package runner for agent skills."
          installed={uvStatus?.installed ?? false}
          version={uvStatus?.version ?? null}
          latestVersion={uvStatus?.latestVersion ?? null}
          hasUpdate={uvStatus?.hasUpdate ?? false}
          isInstalling={isInstallingUv}
          onInstall={makeInstallHandler(setUvStatus, setIsInstallingUv, installUv)}
          docsUrl={UV_URL}
          theme={theme}
          border
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reusable row component
// ---------------------------------------------------------------------------

interface ToolRowProps {
  icon: React.ReactNode;
  title: string;
  hint: string;
  installed: boolean;
  version: string | null;
  latestVersion: string | null;
  hasUpdate: boolean;
  isInstalling: boolean;
  onInstall: () => void;
  docsUrl: string;
  theme: ReturnType<typeof useUnistyles>["theme"];
  border?: boolean;
}

function ToolRow({
  icon, title, hint, installed, version, latestVersion,
  hasUpdate, isInstalling, onInstall, docsUrl, theme, border,
}: ToolRowProps) {
  return (
    <View style={[settingsStyles.row, border && settingsStyles.rowBorder]}>
      <View style={settingsStyles.rowContent}>
        <View style={styles.rowTitleRow}>
          {icon}
          <Text style={settingsStyles.rowTitle}>{title}</Text>
          {installed && version && (
            <Text style={styles.versionTag}>v{version}</Text>
          )}
        </View>
        <Text style={settingsStyles.rowHint}>{hint}</Text>
        {hasUpdate && latestVersion && (
          <Text style={styles.updateHint}>Update available: v{latestVersion}</Text>
        )}
      </View>
      <View style={styles.rowActions}>
        {docsUrl ? (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowUpRight size={12} color={theme.colors.foregroundMuted} />}
            style={styles.docsButton}
            onPress={() => void openExternalUrl(docsUrl)}
            accessibilityLabel={`Open ${title} documentation`}
          />
        ) : null}
        {installed && !hasUpdate ? (
          <View style={styles.installedLabel}>
            <Check size={14} color={theme.colors.foregroundMuted} />
            <Text style={styles.mutedText}>Installed</Text>
          </View>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onPress={onInstall}
            disabled={isInstalling}
            leftIcon={hasUpdate
              ? <RefreshCw size={12} color={theme.colors.foreground} />
              : <Download size={12} color={theme.colors.foreground} />
            }
          >
            {isInstalling ? "Installing..." : hasUpdate ? "Update" : "Install"}
          </Button>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  headerLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[0],
  },
  rowTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
    flexWrap: "wrap",
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[2],
  },
  installedLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mutedText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  versionTag: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    backgroundColor: theme.colors.surface1,
    paddingHorizontal: theme.spacing[1],
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  updateHint: {
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  docsButton: {
    paddingHorizontal: theme.spacing[1],
  },
}));
