import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as QRCode from "qrcode";
import { useFocusEffect } from "@react-navigation/native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { settingsStyles } from "@/styles/settings";
import {
  ArrowUpRight,
  Play,
  Pause,
  RotateCw,
  Terminal,
  Copy,
  FileText,
  Smartphone,
} from "lucide-react-native";
import { AdaptiveModalSheet } from "@/components/adaptive-modal-sheet";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/hooks/use-settings";
import { confirmDialog } from "@/utils/confirm-dialog";
import { openExternalUrl } from "@/utils/open-external-url";
import { getLocalDaemonVersion, isVersionMismatch } from "@/desktop/updates/desktop-updates";
import {
  getCliSymlinkInstructions,
  getDesktopDaemonLogs,
  getDesktopDaemonPairing,
  getDesktopDaemonStatus,
  restartDesktopDaemon,
  shouldUseDesktopDaemon,
  startDesktopDaemon,
  stopDesktopDaemon,
  type CliSymlinkInstructions,
  type DesktopDaemonLogs,
  type DesktopDaemonStatus,
  type DesktopPairingOffer,
} from "@/desktop/daemon/desktop-daemon";

export interface LocalDaemonSectionProps {
  appVersion: string | null;
  showLifecycleControls: boolean;
}

export function LocalDaemonSection({ appVersion, showLifecycleControls }: LocalDaemonSectionProps) {
  const { theme } = useUnistyles();
  const showSection = shouldUseDesktopDaemon();
  const { settings, updateSettings } = useAppSettings();
  const [daemonStatus, setDaemonStatus] = useState<DesktopDaemonStatus | null>(null);
  const [daemonVersion, setDaemonVersion] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isRestartingDaemon, setIsRestartingDaemon] = useState(false);
  const [isUpdatingDaemonManagement, setIsUpdatingDaemonManagement] = useState(false);
  const [isLoadingCliSymlinkInstructions, setIsLoadingCliSymlinkInstructions] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cliStatusMessage, setCliStatusMessage] = useState<string | null>(null);
  const [daemonLogs, setDaemonLogs] = useState<DesktopDaemonLogs | null>(null);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isCliSymlinkModalOpen, setIsCliSymlinkModalOpen] = useState(false);
  const [isLoadingPairing, setIsLoadingPairing] = useState(false);
  const [pairingOffer, setPairingOffer] = useState<DesktopPairingOffer | null>(null);
  const [cliSymlinkInstructions, setCliSymlinkInstructions] =
    useState<CliSymlinkInstructions | null>(null);
  const [pairingStatusMessage, setPairingStatusMessage] = useState<string | null>(null);

  const loadDaemonData = useCallback(() => {
    if (!showSection) {
      return Promise.resolve();
    }
    return Promise.all([getDesktopDaemonStatus(), getDesktopDaemonLogs(), getLocalDaemonVersion()])
      .then(([status, logs, version]) => {
        setDaemonStatus(status);
        setDaemonLogs(logs);
        setDaemonVersion(version.version);
        setStatusError(null);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatusError(message);
      });
  }, [showSection]);

  useFocusEffect(
    useCallback(() => {
      if (!showSection) {
        return undefined;
      }
      void loadDaemonData();
      return undefined;
    }, [loadDaemonData, showSection]),
  );

  const daemonVersionMismatch = isVersionMismatch(appVersion, daemonVersion);
  const daemonStatusStateText =
    statusError ?? (daemonStatus?.status === "running" ? daemonStatus.status : "not running");
  const daemonStatusDetailText = `PID ${daemonStatus?.pid ? daemonStatus.pid : "—"}`;
  const isDaemonManagementPaused = !settings.manageBuiltInDaemon;
  const daemonActionLabel = daemonStatus?.status === "running" ? "Restart daemon" : "Start daemon";
  const daemonActionMessage =
    daemonStatus?.status === "running"
      ? "Restarts the built-in daemon."
      : "Starts the built-in daemon.";

  const handleUpdateLocalDaemon = useCallback(() => {
    if (!showSection || isRestartingDaemon) {
      return;
    }

    void confirmDialog({
      title: daemonActionLabel,
      message:
        daemonStatus?.status === "running"
          ? "This will restart the built-in daemon. The app will reconnect automatically."
          : "This will start the built-in daemon.",
      confirmLabel: daemonActionLabel,
      cancelLabel: "Cancel",
    })
      .then((confirmed) => {
        if (!confirmed) {
          return;
        }

        setIsRestartingDaemon(true);
        setStatusMessage(null);

        const action =
          daemonStatus?.status === "running" ? restartDesktopDaemon : startDesktopDaemon;

        void action()
          .then((status) => {
            setDaemonStatus(status);
            setStatusMessage(
              daemonStatus?.status === "running" ? "Daemon restarted." : "Daemon started.",
            );
            return loadDaemonData();
          })
          .catch((error) => {
            console.error("[Settings] Failed to change desktop daemon state", error);
            const message = error instanceof Error ? error.message : String(error);
            setStatusMessage(`${daemonActionLabel} failed: ${message}`);
          })
          .finally(() => {
            setIsRestartingDaemon(false);
          });
      })
      .catch((error) => {
        console.error("[Settings] Failed to open desktop daemon action confirmation", error);
        Alert.alert("Error", "Unable to open the daemon confirmation dialog.");
      });
  }, [daemonActionLabel, daemonStatus?.status, isRestartingDaemon, loadDaemonData, showSection]);

  const handleToggleDaemonManagement = useCallback(() => {
    if (isUpdatingDaemonManagement) {
      return;
    }

    if (!settings.manageBuiltInDaemon) {
      setIsUpdatingDaemonManagement(true);
      setStatusMessage(null);
      void updateSettings({ manageBuiltInDaemon: true })
        .then(() => {
          setStatusMessage("Built-in daemon management resumed.");
        })
        .catch((error) => {
          console.error("[Settings] Failed to update built-in daemon management", error);
          Alert.alert("Error", "Unable to update built-in daemon management.");
        })
        .finally(() => {
          setIsUpdatingDaemonManagement(false);
        });
      return;
    }

    void confirmDialog({
      title: "Pause built-in daemon",
      message:
        "This will stop the built-in daemon immediately. Running agents and terminals connected to the built-in daemon will be stopped.",
      confirmLabel: "Pause and stop",
      cancelLabel: "Cancel",
      destructive: true,
    })
      .then((confirmed) => {
        if (!confirmed) {
          return;
        }

        setIsUpdatingDaemonManagement(true);
        setStatusMessage(null);

        const stopPromise =
          daemonStatus?.status === "running"
            ? stopDesktopDaemon()
            : Promise.resolve(daemonStatus ?? null);

        void stopPromise
          .then(() => updateSettings({ manageBuiltInDaemon: false }))
          .then(() => loadDaemonData())
          .then(() => {
            setStatusMessage("Built-in daemon paused and stopped.");
          })
          .catch((error) => {
            console.error("[Settings] Failed to pause built-in daemon management", error);
            Alert.alert("Error", "Unable to pause built-in daemon management.");
          })
          .finally(() => {
            setIsUpdatingDaemonManagement(false);
          });
      })
      .catch((error) => {
        console.error("[Settings] Failed to open built-in daemon pause confirmation", error);
        Alert.alert("Error", "Unable to open the daemon confirmation dialog.");
      });
  }, [
    daemonStatus,
    isUpdatingDaemonManagement,
    loadDaemonData,
    settings.manageBuiltInDaemon,
    updateSettings,
  ]);

  const handleOpenCliSymlinkInstructions = useCallback(() => {
    if (!showSection || isLoadingCliSymlinkInstructions) {
      return;
    }
    setIsLoadingCliSymlinkInstructions(true);
    setCliStatusMessage(null);
    void getCliSymlinkInstructions()
      .then((instructions) => {
        setCliSymlinkInstructions(instructions);
        setIsCliSymlinkModalOpen(true);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setCliStatusMessage(`Unable to load CLI symlink instructions: ${message}`);
      })
      .finally(() => {
        setIsLoadingCliSymlinkInstructions(false);
      });
  }, [isLoadingCliSymlinkInstructions, showSection]);

  const handleCopyCliSymlinkCommands = useCallback(() => {
    if (!cliSymlinkInstructions?.commands) {
      return;
    }
    void Clipboard.setStringAsync(cliSymlinkInstructions.commands)
      .then(() => {
        Alert.alert("Copied", "CLI symlink commands copied.");
      })
      .catch((error) => {
        console.error("[Settings] Failed to copy CLI symlink commands", error);
        Alert.alert("Error", "Unable to copy CLI symlink commands.");
      });
  }, [cliSymlinkInstructions?.commands]);

  const handleCopyLogPath = useCallback(() => {
    const logPath = daemonLogs?.logPath;
    if (!logPath) {
      return;
    }

    void Clipboard.setStringAsync(logPath)
      .then(() => {
        Alert.alert("Copied", "Log path copied.");
      })
      .catch((error) => {
        console.error("[Settings] Failed to copy log path", error);
        Alert.alert("Error", "Unable to copy log path.");
      });
  }, [daemonLogs?.logPath]);

  const handleOpenLogs = useCallback(() => {
    if (!daemonLogs) {
      return;
    }
    setIsLogsModalOpen(true);
  }, [daemonLogs]);

  const handleOpenPairingModal = useCallback(() => {
    if (isLoadingPairing) {
      return;
    }

    setIsPairingModalOpen(true);
    setIsLoadingPairing(true);
    setPairingStatusMessage(null);

    void getDesktopDaemonPairing()
      .then((pairing) => {
        setPairingOffer(pairing);
        if (!pairing.relayEnabled || !pairing.url) {
          setPairingStatusMessage("Relay pairing is not available.");
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setPairingOffer(null);
        setPairingStatusMessage(`Unable to load pairing offer: ${message}`);
      })
      .finally(() => {
        setIsLoadingPairing(false);
      });
  }, [isLoadingPairing]);

  const handleCopyPairingLink = useCallback(() => {
    if (!pairingOffer?.url) {
      return;
    }
    void Clipboard.setStringAsync(pairingOffer.url)
      .then(() => {
        Alert.alert("Copied", "Pairing link copied.");
      })
      .catch((error) => {
        console.error("[Settings] Failed to copy pairing link", error);
        Alert.alert("Error", "Unable to copy pairing link.");
      });
  }, [pairingOffer?.url]);

  if (!showSection) {
    return null;
  }

  return (
    <View style={settingsStyles.section}>
      <View style={styles.sectionHeader}>
        <Text style={settingsStyles.sectionTitle}>Built-in daemon</Text>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowUpRight size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />}
          textStyle={styles.sectionLinkText}
          style={styles.sectionLink}
          onPress={() => void openExternalUrl(ADVANCED_DAEMON_SETTINGS_URL)}
          accessibilityLabel="Open advanced daemon settings"
        >
          Advanced settings
        </Button>
      </View>
      <View style={settingsStyles.card}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Status</Text>
            <Text style={styles.hintText}>Only the built-in desktop daemon is shown here.</Text>
          </View>
          <View style={styles.statusValueGroup}>
            <Text style={styles.valueText}>{daemonStatusStateText}</Text>
            <Text style={styles.valueSubtext}>{daemonStatusDetailText}</Text>
          </View>
        </View>
        {showLifecycleControls ? (
          <>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>Daemon management</Text>
                <Text style={styles.hintText}>
                  {isDaemonManagementPaused
                    ? "Paused. The built-in daemon stays stopped until you start it again."
                    : "Enabled. SuperAgent can manage the built-in daemon from the desktop app."}
                </Text>
              </View>
              <Button
                variant="outline"
                size="sm"
                leftIcon={
                  isDaemonManagementPaused ? (
                    <Play size={theme.iconSize.sm} color={theme.colors.foreground} />
                  ) : (
                    <Pause size={theme.iconSize.sm} color={theme.colors.foreground} />
                  )
                }
                onPress={handleToggleDaemonManagement}
                disabled={isUpdatingDaemonManagement}
              >
                {isUpdatingDaemonManagement
                  ? isDaemonManagementPaused
                    ? "Resuming..."
                    : "Pausing..."
                  : isDaemonManagementPaused
                    ? "Resume"
                    : "Pause"}
              </Button>
            </View>
            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowContent}>
                <Text style={styles.rowTitle}>{daemonActionLabel}</Text>
                <Text style={styles.hintText}>{daemonActionMessage}</Text>
                {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
              </View>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCw size={theme.iconSize.sm} color={theme.colors.foreground} />}
                onPress={handleUpdateLocalDaemon}
                disabled={isRestartingDaemon}
              >
                {isRestartingDaemon
                  ? daemonStatus?.status === "running"
                    ? "Restarting..."
                    : "Starting..."
                  : daemonActionLabel}
              </Button>
            </View>
          </>
        ) : null}
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Command line (CLI)</Text>
            <Text style={styles.hintText}>Shows the command to add `paseo` to your terminal.</Text>
            {cliStatusMessage ? <Text style={styles.statusText}>{cliStatusMessage}</Text> : null}
          </View>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Terminal size={theme.iconSize.sm} color={theme.colors.foreground} />}
            onPress={handleOpenCliSymlinkInstructions}
            disabled={isLoadingCliSymlinkInstructions}
          >
            {isLoadingCliSymlinkInstructions ? "Loading..." : "Show instructions"}
          </Button>
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Log file</Text>
            <Text style={styles.hintText}>{daemonLogs?.logPath ?? "Log path unavailable."}</Text>
          </View>
          <View style={styles.actionGroup}>
            {daemonLogs?.logPath ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Copy size={theme.iconSize.sm} color={theme.colors.foreground} />}
                onPress={handleCopyLogPath}
              >
                Copy path
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<FileText size={theme.iconSize.sm} color={theme.colors.foreground} />}
              onPress={handleOpenLogs}
              disabled={!daemonLogs}
            >
              Open logs
            </Button>
          </View>
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Pair device</Text>
            <Text style={styles.hintText}>Connect your phone to this computer.</Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Smartphone size={theme.iconSize.sm} color={theme.colors.foreground} />}
            onPress={handleOpenPairingModal}
          >
            Pair device
          </Button>
        </View>
      </View>

      {daemonVersionMismatch ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            App and daemon versions don't match. Update both to the same version for the best
            experience.
          </Text>
        </View>
      ) : null}

      <AdaptiveModalSheet
        visible={isCliSymlinkModalOpen}
        onClose={() => setIsCliSymlinkModalOpen(false)}
        title="Add SuperAgent to your shell"
        testID="managed-daemon-cli-symlink-dialog"
      >
        <View style={styles.modalBody}>
          <Text style={styles.hintText}>
            SuperAgent does not add the command for you. Run the command below in your terminal.
          </Text>
          {cliSymlinkInstructions?.detail ? (
            <Text style={styles.hintText}>{cliSymlinkInstructions.detail}</Text>
          ) : null}
          <Text style={styles.codeBlock} selectable>
            {cliSymlinkInstructions?.commands ?? ""}
          </Text>
          <View style={styles.modalActions}>
            <Button variant="outline" size="sm" onPress={() => setIsCliSymlinkModalOpen(false)}>
              Close
            </Button>
            <Button size="sm" onPress={handleCopyCliSymlinkCommands}>
              Copy commands
            </Button>
          </View>
        </View>
      </AdaptiveModalSheet>

      <AdaptiveModalSheet
        visible={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        title="Pair device"
        testID="managed-daemon-pairing-dialog"
      >
        <PairingOfferDialogContent
          isLoading={isLoadingPairing}
          pairingOffer={pairingOffer}
          statusMessage={pairingStatusMessage}
          onCopyLink={handleCopyPairingLink}
        />
      </AdaptiveModalSheet>

      <AdaptiveModalSheet
        visible={isLogsModalOpen}
        onClose={() => setIsLogsModalOpen(false)}
        title="Daemon logs"
        testID="managed-daemon-logs-dialog"
        snapPoints={["70%", "92%"]}
      >
        <View style={styles.modalBody}>
          <Text style={styles.hintText}>{daemonLogs?.logPath ?? "Log path unavailable."}</Text>
          <Text style={styles.logOutput} selectable>
            {daemonLogs?.contents.length ? daemonLogs.contents : "(log file is empty)"}
          </Text>
        </View>
      </AdaptiveModalSheet>
    </View>
  );
}

const ADVANCED_DAEMON_SETTINGS_URL = "https://paseo.sh/docs/configuration";

function PairingOfferDialogContent(input: {
  isLoading: boolean;
  pairingOffer: DesktopPairingOffer | null;
  statusMessage: string | null;
  onCopyLink: () => void;
}) {
  const { isLoading, pairingOffer, statusMessage, onCopyLink } = input;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!pairingOffer?.url) {
      setQrDataUrl(null);
      setQrError(null);
      return () => {
        cancelled = true;
      };
    }

    setQrError(null);
    setQrDataUrl(null);

    void QRCode.toDataURL(pairingOffer.url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 480,
    })
      .then((dataUrl) => {
        if (cancelled) {
          return;
        }
        setQrDataUrl(dataUrl);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setQrError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      cancelled = true;
    };
  }, [pairingOffer?.url]);

  if (isLoading) {
    return (
      <View style={styles.pairingState}>
        <ActivityIndicator size="small" />
        <Text style={styles.hintText}>Loading pairing offer…</Text>
      </View>
    );
  }

  if (statusMessage) {
    return (
      <View style={styles.modalBody}>
        <Text style={styles.hintText}>{statusMessage}</Text>
      </View>
    );
  }

  if (!pairingOffer?.url) {
    return (
      <View style={styles.modalBody}>
        <Text style={styles.hintText}>Pairing offer unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.modalBody}>
      <Text style={styles.hintText}>
        Scan this QR code in SuperAgent, or copy the pairing link below.
      </Text>
      <View style={styles.qrCard}>
        {qrDataUrl ? (
          <Image source={{ uri: qrDataUrl }} style={styles.qrImage} resizeMode="contain" />
        ) : qrError ? (
          <Text style={styles.hintText}>QR unavailable: {qrError}</Text>
        ) : (
          <ActivityIndicator size="small" />
        )}
      </View>
      <View style={styles.linkSection}>
        <Text style={styles.linkLabel}>Pairing link</Text>
        <Text style={styles.linkText} selectable>
          {pairingOffer.url}
        </Text>
      </View>
      <View style={styles.modalActions}>
        <Button variant="outline" size="sm" onPress={onCopyLink}>
          Copy link
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.spacing[3],
    marginLeft: theme.spacing[1],
  },
  sectionLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing[1],
  },
  sectionLinkText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowContent: {
    flex: 1,
    marginRight: theme.spacing[3],
  },
  actionGroup: {
    flexDirection: "row",
    gap: theme.spacing[2],
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  statusValueGroup: {
    alignItems: "flex-end",
    gap: 2,
  },
  rowTitle: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.base,
  },
  valueText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.normal,
  },
  valueSubtext: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
  },
  hintText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  statusText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    marginTop: theme.spacing[1],
  },
  warningCard: {
    marginTop: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.palette.amber[500],
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[3],
  },
  warningText: {
    color: theme.colors.palette.amber[500],
    fontSize: theme.fontSize.xs,
  },
  modalBody: {
    gap: theme.spacing[3],
    paddingBottom: theme.spacing[2],
  },
  pairingState: {
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    paddingVertical: theme.spacing[6],
  },
  qrCard: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    aspectRatio: 1,
    alignSelf: "stretch",
    padding: theme.spacing[3],
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface0,
  },
  qrImage: {
    width: "100%",
    height: "100%",
  },
  linkSection: {
    gap: theme.spacing[2],
  },
  linkLabel: {
    color: theme.colors.foreground,
    fontSize: theme.fontSize.sm,
  },
  linkText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    lineHeight: 18,
  },
  logOutput: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: 18,
  },
  codeBlock: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.xs,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    lineHeight: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface0,
    padding: theme.spacing[3],
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
  },
}));
