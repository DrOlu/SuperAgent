import { promises as fs } from "node:fs";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createGunzip } from "node:zlib";
import * as https from "node:https";
import { app } from "electron";
import log from "electron-log/main";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolInstallStatus {
  installed: boolean;
  version: string | null;
  latestVersion: string | null;
  hasUpdate: boolean;
  path: string | null;
}

interface ToolsManifest {
  [toolName: string]: {
    version: string;
    installedAt: string;
    lastChecked: string;
    path: string;
  };
}

interface GitHubRelease {
  tag_name: string;
  assets: Array<{ name: string; browser_download_url: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPDATE_CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const GITHUB_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getToolsBinDir(): string {
  if (app.isPackaged) {
    // Place alongside the app so it survives user data clears
    return path.join(path.dirname(app.getPath("exe")), "resources", "tools");
  }
  return path.join(os.homedir(), ".paseo", "tools");
}

function getToolsManifestPath(): string {
  return path.join(os.homedir(), ".paseo", "tools.json");
}

function getToolExeName(baseName: string): string {
  return process.platform === "win32" ? `${baseName}.exe` : baseName;
}

function getToolPath(baseName: string): string {
  return path.join(getToolsBinDir(), getToolExeName(baseName));
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

async function readManifest(): Promise<ToolsManifest> {
  try {
    const raw = await fs.readFile(getToolsManifestPath(), "utf-8");
    return JSON.parse(raw) as ToolsManifest;
  } catch {
    return {};
  }
}

async function writeManifest(manifest: ToolsManifest): Promise<void> {
  const p = getToolsManifestPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(manifest, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// GitHub helpers
// ---------------------------------------------------------------------------

function httpsGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { "User-Agent": "SuperAgent-Desktop" },
      timeout: timeoutMs,
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        httpsGet(res.headers.location!, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error(`Timeout fetching ${url}`)); });
    req.on("error", reject);
  });
}

async function fetchLatestRelease(owner: string, repo: string): Promise<GitHubRelease> {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  const body = await httpsGet(url, GITHUB_TIMEOUT_MS);
  return JSON.parse(body) as GitHubRelease;
}

function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const req = https.get(url, {
      headers: { "User-Agent": "SuperAgent-Desktop" },
      timeout: DOWNLOAD_TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlink(destPath).catch(() => {});
        downloadFile(res.headers.location!, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`)); return;
      }
      pipeline(res, file).then(resolve).catch(reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Download timeout")); });
    req.on("error", reject);
  });
}

import { spawnSync } from "node:child_process";

function extractTarGz(archivePath: string, destDir: string): void {
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", destDir, "--strip-components=1"], {
    encoding: "utf-8",
    timeout: 120_000,
  });
  if (result.status !== 0) {
    throw new Error(`tar extraction failed: ${result.stderr ?? result.error?.message ?? "unknown"}`);
  }
}

function extractZip(archivePath: string, destDir: string, fileNames: string[]): void {
  if (process.platform === "win32") {
    const moveSteps = fileNames
      .map(f => `Get-ChildItem -Recurse "$d\\__tmp" -Filter "${f}" | ForEach-Object { Move-Item $_.FullName "$d\\${f}" -Force }`)
      .join("; ");
    spawnSync("powershell", [
      "-Command",
      `$d="${destDir}"; New-Item -ItemType Directory -Force -Path $d | Out-Null; ` +
      `Expand-Archive -LiteralPath "${archivePath}" -DestinationPath "$d\\__tmp" -Force; ` +
      `${moveSteps}; ` +
      `if (Test-Path "$d\\__tmp") { Get-ChildItem "$d\\__tmp" | ForEach-Object { $_.Delete() } }`,
    ], { encoding: "utf-8", timeout: 120_000 });
  } else {
    for (const name of fileNames) {
      spawnSync("unzip", ["-j", "-o", archivePath, `*/${name}`, "-d", destDir], {
        encoding: "utf-8", timeout: 120_000,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Platform asset resolution
// ---------------------------------------------------------------------------

function resolveOpencodeAsset(release: GitHubRelease): string | null {
  const p = process.platform;
  const arch = process.arch;

  let pattern: string;
  if (p === "win32") pattern = "windows-x64";
  else if (p === "darwin" && arch === "arm64") pattern = "macos-arm64";
  else if (p === "darwin") pattern = "macos-x64";
  else if (arch === "arm64") pattern = "linux-arm64";
  else pattern = "linux-x64";

  const asset = release.assets.find(a =>
    a.name.startsWith("opencode-") &&
    a.name.includes(pattern) &&
    !a.name.endsWith(".sha256")
  );
  return asset?.browser_download_url ?? null;
}

function resolvePiAsset(release: GitHubRelease): string | null {
  const p = process.platform;
  const arch = process.arch;

  let pattern: string;
  if (p === "win32") pattern = "windows-x64";
  else if (p === "darwin" && arch === "arm64") pattern = "macos-arm64";
  else if (p === "darwin") pattern = "macos-x64";
  else if (arch === "arm64") pattern = "linux-arm64";
  else pattern = "linux-x64";

  // pi ships as: pi-linux-x64, pi-macos-arm64, pi-windows-x64.exe etc.
  const asset = release.assets.find(a =>
    (a.name.startsWith("pi-") || a.name === `pi-${pattern}` || a.name === `pi-${pattern}.exe`) &&
    !a.name.endsWith(".sha256") &&
    !a.name.endsWith(".zip")
  );
  // Fallback to zip
  const zipAsset = release.assets.find(a =>
    a.name.includes(pattern) && a.name.endsWith(".zip")
  );
  return asset?.browser_download_url ?? zipAsset?.browser_download_url ?? null;
}

function resolveUvAsset(release: GitHubRelease): string | null {
  const p = process.platform;
  const arch = process.arch;

  let pattern: string;
  if (p === "win32") pattern = "x86_64-pc-windows-msvc";
  else if (p === "darwin" && arch === "arm64") pattern = "aarch64-apple-darwin";
  else if (p === "darwin") pattern = "x86_64-apple-darwin";
  else if (arch === "arm64") pattern = "aarch64-unknown-linux-gnu";
  else pattern = "x86_64-unknown-linux-gnu";

  const asset = release.assets.find(a =>
    a.name.includes(pattern) &&
    (a.name.endsWith(".zip") || a.name.endsWith(".tar.gz")) &&
    !a.name.endsWith(".sha256")
  );
  return asset?.browser_download_url ?? null;
}

// ---------------------------------------------------------------------------
// Install helpers
// ---------------------------------------------------------------------------

async function installSingleBinary(
  url: string,
  finalPath: string,
  isArchive: boolean,
  archiveType: "tar.gz" | "zip",
  binNamesInArchive: string[],
): Promise<void> {
  const binDir = getToolsBinDir();
  await fs.mkdir(binDir, { recursive: true });

  const tmpPath = `${finalPath}.download`;
  const tmpArchivePath = `${finalPath}.archive`;

  try {
    if (!isArchive) {
      // Direct binary download
      await downloadFile(url, tmpPath);
      if (process.platform !== "win32") {
        await fs.chmod(tmpPath, 0o755);
      }
      if (existsSync(finalPath)) await fs.unlink(finalPath);
      await fs.rename(tmpPath, finalPath);
    } else {
      // Archive download + extract
      await downloadFile(url, tmpArchivePath);

      if (archiveType === "tar.gz") {
        extractTarGz(tmpArchivePath, binDir);
      } else {
        extractZip(tmpArchivePath, binDir, binNamesInArchive);
      }

      // Ensure executable
      if (process.platform !== "win32") {
        await fs.chmod(finalPath, 0o755).catch(() => {});
      }
    }
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
    await fs.unlink(tmpArchivePath).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Public: opencode
// ---------------------------------------------------------------------------

export async function getOpencodeStatus(): Promise<ToolInstallStatus> {
  const toolPath = getToolPath("opencode");
  const manifest = await readManifest();
  const entry = manifest.opencode;
  const installed = existsSync(toolPath);

  let latestVersion: string | null = null;
  const now = Date.now();
  const lastChecked = entry ? new Date(entry.lastChecked).getTime() : 0;

  if (now - lastChecked > UPDATE_CHECK_COOLDOWN_MS) {
    try {
      const release = await fetchLatestRelease("anomalyco", "opencode");
      latestVersion = release.tag_name.replace(/^v/, "");
      if (entry) {
        manifest.opencode = { ...entry, lastChecked: new Date().toISOString() };
        await writeManifest(manifest);
      }
    } catch (err) {
      log.warn("[tools] Could not check opencode latest version", err);
    }
  } else {
    latestVersion = entry?.version ?? null;
  }

  const currentVersion = entry?.version ?? null;
  return {
    installed,
    version: currentVersion,
    latestVersion,
    hasUpdate: !!(currentVersion && latestVersion && currentVersion !== latestVersion),
    path: installed ? toolPath : null,
  };
}

export async function installOrUpdateOpencode(): Promise<ToolInstallStatus> {
  log.info("[tools] Installing/updating opencode...");
  const release = await fetchLatestRelease("anomalyco", "opencode");
  const assetUrl = resolveOpencodeAsset(release);
  if (!assetUrl) throw new Error("No opencode asset found for this platform");

  const version = release.tag_name.replace(/^v/, "");
  const finalPath = getToolPath("opencode");
  const isArchive = assetUrl.endsWith(".tar.gz") || assetUrl.endsWith(".zip");
  const archiveType = assetUrl.endsWith(".zip") ? "zip" : "tar.gz";

  await installSingleBinary(assetUrl, finalPath, isArchive, archiveType, [
    getToolExeName("opencode"),
  ]);

  const manifest = await readManifest();
  manifest.opencode = {
    version,
    installedAt: manifest.opencode?.installedAt ?? new Date().toISOString(),
    lastChecked: new Date().toISOString(),
    path: finalPath,
  };
  await writeManifest(manifest);
  await ensureToolsInPath();

  log.info("[tools] opencode installed", { version, path: finalPath });
  return getOpencodeStatus();
}

// ---------------------------------------------------------------------------
// Public: pi
// ---------------------------------------------------------------------------

export async function getPiStatus(): Promise<ToolInstallStatus> {
  const toolPath = getToolPath("pi");
  const manifest = await readManifest();
  const entry = manifest.pi;
  const installed = existsSync(toolPath);

  let latestVersion: string | null = null;
  const now = Date.now();
  const lastChecked = entry ? new Date(entry.lastChecked).getTime() : 0;

  if (now - lastChecked > UPDATE_CHECK_COOLDOWN_MS) {
    try {
      const release = await fetchLatestRelease("badlogic", "pi-mono");
      latestVersion = release.tag_name.replace(/^v/, "");
      if (entry) {
        manifest.pi = { ...entry, lastChecked: new Date().toISOString() };
        await writeManifest(manifest);
      }
    } catch (err) {
      log.warn("[tools] Could not check pi latest version", err);
    }
  } else {
    latestVersion = entry?.version ?? null;
  }

  const currentVersion = entry?.version ?? null;
  return {
    installed,
    version: currentVersion,
    latestVersion,
    hasUpdate: !!(currentVersion && latestVersion && currentVersion !== latestVersion),
    path: installed ? toolPath : null,
  };
}

export async function installOrUpdatePi(): Promise<ToolInstallStatus> {
  log.info("[tools] Installing/updating pi...");
  const release = await fetchLatestRelease("badlogic", "pi-mono");
  const assetUrl = resolvePiAsset(release);
  if (!assetUrl) throw new Error("No pi asset found for this platform");

  const version = release.tag_name.replace(/^v/, "");
  const finalPath = getToolPath("pi");
  const isArchive = assetUrl.endsWith(".tar.gz") || assetUrl.endsWith(".zip");
  const archiveType = assetUrl.endsWith(".zip") ? "zip" : "tar.gz";

  await installSingleBinary(assetUrl, finalPath, isArchive, archiveType, [
    getToolExeName("pi"),
  ]);

  const manifest = await readManifest();
  manifest.pi = {
    version,
    installedAt: manifest.pi?.installedAt ?? new Date().toISOString(),
    lastChecked: new Date().toISOString(),
    path: finalPath,
  };
  await writeManifest(manifest);
  await ensureToolsInPath();
  await writePiProviderConfig(finalPath);

  log.info("[tools] pi installed", { version, path: finalPath });
  return getPiStatus();
}

// ---------------------------------------------------------------------------
// Public: uv + uvx
// ---------------------------------------------------------------------------

export async function getUvStatus(): Promise<ToolInstallStatus> {
  const toolPath = getToolPath("uv");
  const manifest = await readManifest();
  const entry = manifest.uv;
  const installed = existsSync(toolPath);

  let latestVersion: string | null = null;
  const now = Date.now();
  const lastChecked = entry ? new Date(entry.lastChecked).getTime() : 0;

  if (now - lastChecked > UPDATE_CHECK_COOLDOWN_MS) {
    try {
      const release = await fetchLatestRelease("astral-sh", "uv");
      latestVersion = release.tag_name.replace(/^v/, "");
      if (entry) {
        manifest.uv = { ...entry, lastChecked: new Date().toISOString() };
        await writeManifest(manifest);
      }
    } catch (err) {
      log.warn("[tools] Could not check uv latest version", err);
    }
  } else {
    latestVersion = entry?.version ?? null;
  }

  const currentVersion = entry?.version ?? null;
  return {
    installed,
    version: currentVersion,
    latestVersion,
    hasUpdate: !!(currentVersion && latestVersion && currentVersion !== latestVersion),
    path: installed ? toolPath : null,
  };
}

export async function installOrUpdateUv(): Promise<ToolInstallStatus> {
  log.info("[tools] Installing/updating uv+uvx...");
  const release = await fetchLatestRelease("astral-sh", "uv");
  const assetUrl = resolveUvAsset(release);
  if (!assetUrl) throw new Error("No uv asset found for this platform");

  const version = release.tag_name.replace(/^v/, "");
  const binDir = getToolsBinDir();
  const uvPath = getToolPath("uv");
  const uvxPath = getToolPath("uvx");
  const tmpArchive = path.join(binDir, "uv-download.archive");

  await fs.mkdir(binDir, { recursive: true });
  await downloadFile(assetUrl, tmpArchive);

  const binNames = [getToolExeName("uv"), getToolExeName("uvx")];
  if (assetUrl.endsWith(".zip")) {
    extractZip(tmpArchive, binDir, binNames);
  } else {
    // tar.gz — extract both uv and uvx
    for (const name of binNames) {
      const dest = path.join(binDir, name);
      try { extractTarGz(tmpArchive, binDir); } catch { /* continue */ }
      if (process.platform !== "win32") {
        await fs.chmod(dest, 0o755).catch(() => {});
      }
    }
  }
  await fs.unlink(tmpArchive).catch(() => {});

  const manifest = await readManifest();
  const now = new Date().toISOString();
  manifest.uv = {
    version,
    installedAt: manifest.uv?.installedAt ?? now,
    lastChecked: now,
    path: uvPath,
  };
  await writeManifest(manifest);
  await ensureToolsInPath();

  log.info("[tools] uv+uvx installed", { version, uvPath, uvxPath });
  return getUvStatus();
}

// ---------------------------------------------------------------------------
// PATH management
// ---------------------------------------------------------------------------

async function ensureToolsInPath(): Promise<void> {
  const toolsDir = getToolsBinDir();

  if (process.platform === "win32") {
    await ensureWindowsUserPath(toolsDir);
  } else {
    await ensureUnixShellPath(toolsDir);
  }

  // Also update current process PATH immediately for child processes (agents)
  const currentPath = process.env.PATH ?? "";
  if (!currentPath.split(path.delimiter).includes(toolsDir)) {
    process.env.PATH = `${toolsDir}${path.delimiter}${currentPath}`;
  }
}

async function ensureWindowsUserPath(toolsDir: string): Promise<void> {
  const { spawnSync } = await import("node:child_process");
  // Read current user PATH from registry
  const result = spawnSync("powershell", [
    "-Command",
    `[Environment]::GetEnvironmentVariable("PATH", "User")`,
  ], { encoding: "utf-8", timeout: 10_000 });

  const currentPath = result.stdout?.trim() ?? "";
  if (currentPath.toLowerCase().includes(toolsDir.toLowerCase())) return;

  const newPath = currentPath ? `${currentPath};${toolsDir}` : toolsDir;
  spawnSync("powershell", [
    "-Command",
    `[Environment]::SetEnvironmentVariable("PATH", "${newPath}", "User")`,
  ], { encoding: "utf-8", timeout: 10_000 });

  log.info("[tools] Added tools dir to Windows user PATH", { toolsDir });
}

async function ensureUnixShellPath(toolsDir: string): Promise<void> {
  const shell = process.env.SHELL ?? "";
  const shellName = path.basename(shell);
  const exportLine = `export PATH="${toolsDir}:$PATH"`;
  const checkPattern = toolsDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let rcFile: string | null = null;
  if (shellName === "zsh") rcFile = path.join(os.homedir(), ".zshrc");
  else if (shellName === "bash") {
    rcFile = process.platform === "darwin"
      ? path.join(os.homedir(), ".bash_profile")
      : path.join(os.homedir(), ".bashrc");
  } else if (shellName === "fish") {
    rcFile = path.join(os.homedir(), ".config", "fish", "config.fish");
  }

  if (!rcFile) return;

  try {
    let content = "";
    try { content = await fs.readFile(rcFile, "utf-8"); } catch {}
    if (new RegExp(checkPattern).test(content)) return;
    await fs.mkdir(path.dirname(rcFile), { recursive: true });
    await fs.appendFile(rcFile, `\n# Added by SuperAgent\n${exportLine}\n`);
    log.info("[tools] Added tools dir to shell rc", { rcFile, toolsDir });
  } catch (err) {
    log.warn("[tools] Could not update shell rc", err);
  }
}

// ---------------------------------------------------------------------------
// Pi config.json integration
// ---------------------------------------------------------------------------

async function writePiProviderConfig(piPath: string): Promise<void> {
  const { resolvePaseoHome } = await import("@getpaseo/server");
  const configPath = path.join(resolvePaseoHome(process.env), "config.json");

  try {
    let config: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch {}

    const agents = (config.agents ?? {}) as Record<string, unknown>;
    const providers = (agents.providers ?? {}) as Record<string, unknown>;

    // Only set if not already configured
    if (!providers.pi) {
      providers.pi = { command: { mode: "replace", argv: [piPath] } };
      agents.providers = providers;
      config.agents = agents;
      await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
      log.info("[tools] Wrote pi provider config", { piPath });
    }
  } catch (err) {
    log.warn("[tools] Could not update pi provider config", err);
  }
}
