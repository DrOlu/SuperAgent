import { app } from "electron";
import { autoUpdater, type UpdateInfo } from "electron-updater";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppUpdateCheckResult = {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  body: string | null;
  date: string | null;
};

export type AppUpdateInstallResult = {
  installed: boolean;
  version: string | null;
  message: string;
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let cachedUpdateInfo: UpdateInfo | null = null;
let downloading = false;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function configureAutoUpdater(): void {
  // Don't auto-download — the user triggers install explicitly.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Suppress built-in dialogs; the renderer handles UI.
  autoUpdater.autoRunAppAfterInstall = true;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function checkForAppUpdate(currentVersion: string): Promise<AppUpdateCheckResult> {
  if (!app.isPackaged) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      body: null,
      date: null,
    };
  }

  configureAutoUpdater();

  try {
    const result = await autoUpdater.checkForUpdates();

    if (!result || !result.updateInfo) {
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        body: null,
        date: null,
      };
    }

    const info = result.updateInfo;
    const latestVersion = info.version;
    const nv = (v: string) => v.replace(/^v/i, '').trim();
    const hasUpdate = nv(latestVersion) !== nv(currentVersion);

    if (hasUpdate) {
      cachedUpdateInfo = info;
    }

    return {
      hasUpdate,
      currentVersion,
      latestVersion,
      body: typeof info.releaseNotes === "string" ? info.releaseNotes : null,
      date: typeof info.releaseDate === "string" ? info.releaseDate : null,
    };
  } catch (error) {
    console.error("[auto-updater] Failed to check for updates:", error);
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      body: null,
      date: null,
    };
  }
}

export async function downloadAndInstallUpdate(
  currentVersion: string,
  onBeforeQuit?: () => Promise<void>,
): Promise<AppUpdateInstallResult> {
  if (!app.isPackaged) {
    return {
      installed: false,
      version: currentVersion,
      message: "Auto-update is not available in development mode.",
    };
  }

  if (downloading) {
    return {
      installed: false,
      version: currentVersion,
      message: "Update already in progress.",
    };
  }

  if (!cachedUpdateInfo) {
    return {
      installed: false,
      version: currentVersion,
      message: "No update available. Check for updates first.",
    };
  }

  configureAutoUpdater();

  downloading = true;

  try {
    await autoUpdater.downloadUpdate();
    // quitAndInstall restarts the app with the new version.
    // Use a short delay to allow the renderer to receive the response.
    setTimeout(async () => {
      try {
        if (onBeforeQuit) await onBeforeQuit();
        autoUpdater.quitAndInstall(/* isSilent */ false, /* isForceRunAfter */ true);
      } catch (error) {
        console.error("[auto-updater] quitAndInstall failed:", error);
      }
    }, 1500);

    return {
      installed: true,
      version: cachedUpdateInfo.version,
      message: "Update downloaded. The app will restart shortly.",
    };
  } catch (error) {
    downloading = false;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[auto-updater] Failed to download/install update:", message);
    return {
      installed: false,
      version: currentVersion,
      message: `Update failed: ${message}`,
    };
  }
}
