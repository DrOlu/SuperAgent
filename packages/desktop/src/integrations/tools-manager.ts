import { promises as fs } from "node:fs";
import { createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
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
  assets: Array<{ name: string; browser_download_url: string; size: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UPDATE_CHECK_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
const GITHUB_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 300_000; // 5 min for large binaries

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getToolsBinDir(): string {
  if (app.isPackaged) {
    return path.join(path.dirname(app.getPath("exe")), "resources", "tools");
  }
  return path.join(os.homedir(), ".paseo", "tools");
}

function getToolsManifestPath(): string {
  return path.join(os.homedir(), ".paseo", "tools.json");
}

function exeName(base: string): string {
  return process.platform === "win32" ? `${base}.exe` : base;
}

function getToolPath(base: string): string {
  return path.join(getToolsBinDir(), exeName(base));
}

// ---------------------------------------------------------------------------
// Manifest helpers
// ---------------------------------------------------------------------------

async function readManifest(): Promise<ToolsManifest> {
  try {
    return JSON.parse(await fs.readFile(getToolsManifestPath(), "utf-8")) as ToolsManifest;
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
// HTTP helpers
// ---------------------------------------------------------------------------

function httpsGet(url: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "SuperAgent-Desktop" }, timeout: timeoutMs }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        httpsGet(res.headers.location, timeoutMs).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
  });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = https.get(url, { headers: { "User-Agent": "SuperAgent-Desktop" }, timeout: DOWNLOAD_TIMEOUT_MS }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        file.close();
        fs.unlink(dest).catch(() => {});
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      pipeline(res, file).then(resolve).catch(reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("Download timeout")); });
    req.on("error", reject);
  });
}

async function fetchLatestRelease(owner: string, repo: string): Promise<GitHubRelease> {
  return JSON.parse(await httpsGet(`https://api.github.com/repos/${owner}/${repo}/releases/latest`, GITHUB_TIMEOUT_MS)) as GitHubRelease;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract a specific binary from a tar.gz archive.
 * @param stripComponents - 0 if binary is at root, 1 if inside a subdir
 */
function extractFromTarGz(archive: string, destDir: string, binName: string, stripComponents: number): void {
  // Windows 10+ has built-in tar. macOS/Linux always have it.
  const result = spawnSync(
    "tar",
    ["-xzf", archive, "-C", destDir, `--strip-components=${stripComponents}`, binName],
    { encoding: "utf-8", timeout: 120_000 }
  );
  if (result.status !== 0) {
    // Try without filter (extract all, we'll pick the file)
    const result2 = spawnSync("tar", ["-xzf", archive, "-C", destDir, `--strip-components=${stripComponents}`], {
      encoding: "utf-8", timeout: 120_000,
    });
    if (result2.status !== 0) {
      throw new Error(`tar failed: ${result2.stderr ?? result2.error?.message ?? "unknown"}`);
    }
  }
}

/**
 * Extract a specific binary from a zip archive.
 * @param noSubdir - true if binary is at root of zip (no subdirectory)
 */
function extractFromZip(archive: string, destDir: string, binNames: string[]): void {
  if (process.platform === "win32") {
    // PowerShell: expand to temp subdir then move target binaries out
    const tmpSub = path.join(destDir, "__extract_tmp");
    const moveSteps = binNames
      .map(n => `$f = Get-ChildItem -Recurse "${tmpSub}" -Filter "${n}" -ErrorAction SilentlyContinue | Select-Object -First 1; if ($f) { Move-Item $f.FullName "${destDir}\\${n}" -Force }`)
      .join("; ");
    const script =
      `$e="${archive}"; $d="${tmpSub}"; ` +
      `New-Item -ItemType Directory -Force -Path $d | Out-Null; ` +
      `Expand-Archive -LiteralPath $e -DestinationPath $d -Force; ` +
      `${moveSteps}; ` +
      `if (Test-Path $d) { Get-ChildItem $d | ForEach-Object { $_.Delete() }; [System.IO.Directory]::Delete($d, $true) 2>$null }`;
    const r = spawnSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf-8", timeout: 120_000 });
    if (r.status !== 0) {
      throw new Error(`PowerShell extract failed: ${r.stderr}`);
    }
  } else {
    // Unix: use unzip -j to flatten (extracts matching files regardless of path)
    for (const name of binNames) {
      const r = spawnSync("unzip", ["-j", "-o", archive, `*/${name}`, "-d", destDir], {
        encoding: "utf-8", timeout: 120_000,
      });
      if (r.status !== 0) {
        // Try without path prefix
        spawnSync("unzip", ["-j", "-o", archive, name, "-d", destDir], {
          encoding: "utf-8", timeout: 120_000,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// opencode
// Asset: opencode-{os}-{arch}.zip (macOS/Windows) or .tar.gz (Linux)
// Binary: at ROOT of archive (strip-components=0)
// ---------------------------------------------------------------------------

function resolveOpencodeAsset(release: GitHubRelease): { url: string; isZip: boolean } | null {
  const p = process.platform;
  const arch = process.arch;

  // Target the CLI binary archives only — NOT desktop/electron variants
  // Pattern: opencode-{os}-{arch}.{zip|tar.gz}
  let prefix: string;
  if (p === "win32") prefix = "opencode-windows-x64";
  else if (p === "darwin" && arch === "arm64") prefix = "opencode-darwin-arm64";
  else if (p === "darwin") prefix = "opencode-darwin-x64";
  else if (arch === "arm64") prefix = "opencode-linux-arm64";
  else prefix = "opencode-linux-x64";

  // Match EXACTLY the CLI asset — must NOT contain "desktop" or "electron"
  const asset = release.assets.find(a =>
    (a.name === `${prefix}.zip` || a.name === `${prefix}.tar.gz`) &&
    !a.name.includes("desktop") &&
    !a.name.includes("electron") &&
    !a.name.includes("baseline") &&
    !a.name.endsWith(".sig")
  );
  if (!asset) return null;
  return { url: asset.browser_download_url, isZip: asset.name.endsWith(".zip") };
}

export async function getOpencodeStatus(): Promise<ToolInstallStatus> {
  return getToolStatus("opencode", "anomalyco", "opencode");
}

export async function installOrUpdateOpencode(): Promise<ToolInstallStatus> {
  log.info("[tools] Installing/updating opencode...");
  const release = await fetchLatestRelease("anomalyco", "opencode");
  const asset = resolveOpencodeAsset(release);
  if (!asset) throw new Error(`No opencode CLI binary found for ${process.platform}/${process.arch}`);

  const version = release.tag_name.replace(/^v/, "");
  const binDir = getToolsBinDir();
  const finalPath = getToolPath("opencode");
  const tmpArchive = path.join(binDir, `opencode-download.${asset.isZip ? "zip" : "tar.gz"}`);

  await fs.mkdir(binDir, { recursive: true });
  log.info("[tools] Downloading opencode", { url: asset.url, size: "~50MB" });
  await downloadFile(asset.url, tmpArchive);

  try {
    if (asset.isZip) {
      // Binary at root of zip
      extractFromZip(tmpArchive, binDir, [exeName("opencode")]);
    } else {
      // Binary at root of tar.gz (strip-components=0)
      extractFromTarGz(tmpArchive, binDir, exeName("opencode"), 0);
    }

    // Ensure executable
    if (process.platform !== "win32") {
      await fs.chmod(finalPath, 0o755);
    }
  } finally {
    await fs.unlink(tmpArchive).catch(() => {});
  }

  if (!existsSync(finalPath)) {
    throw new Error(`opencode binary not found at ${finalPath} after extraction`);
  }

  await updateManifest("opencode", version, finalPath);
  await ensureToolsInPath();
  log.info("[tools] opencode installed", { version, path: finalPath });
  return getOpencodeStatus();
}

// ---------------------------------------------------------------------------
// Pi
// Asset: pi-{os}-{arch}.tar.gz or pi-windows-x64.zip
// Binary: inside pi/ subdir (strip-components=1)
// ---------------------------------------------------------------------------

function resolvePiAsset(release: GitHubRelease): { url: string; isZip: boolean } | null {
  const p = process.platform;
  const arch = process.arch;

  let name: string;
  if (p === "win32") name = "pi-windows-x64.zip";
  else if (p === "darwin" && arch === "arm64") name = "pi-darwin-arm64.tar.gz";
  else if (p === "darwin") name = "pi-darwin-x64.tar.gz";
  else if (arch === "arm64") name = "pi-linux-arm64.tar.gz";
  else name = "pi-linux-x64.tar.gz";

  const asset = release.assets.find(a => a.name === name);
  if (!asset) return null;
  return { url: asset.browser_download_url, isZip: name.endsWith(".zip") };
}

export async function getPiStatus(): Promise<ToolInstallStatus> {
  return getToolStatus("pi", "badlogic", "pi-mono");
}

export async function installOrUpdatePi(): Promise<ToolInstallStatus> {
  log.info("[tools] Installing/updating pi...");
  const release = await fetchLatestRelease("badlogic", "pi-mono");
  const asset = resolvePiAsset(release);
  if (!asset) throw new Error(`No pi asset found for ${process.platform}/${process.arch}`);

  const version = release.tag_name.replace(/^v/, "");
  const binDir = getToolsBinDir();
  const finalPath = getToolPath("pi");
  const tmpArchive = path.join(binDir, `pi-download.${asset.isZip ? "zip" : "tar.gz"}`);

  await fs.mkdir(binDir, { recursive: true });
  log.info("[tools] Downloading pi", { url: asset.url });
  await downloadFile(asset.url, tmpArchive);

  try {
    if (asset.isZip) {
      // Inside pi/ subdir in zip
      extractFromZip(tmpArchive, binDir, [exeName("pi")]);
    } else {
      // Inside pi/ subdir in tar.gz → strip-components=1
      extractFromTarGz(tmpArchive, binDir, `pi/${exeName("pi")}`, 1);
    }

    if (process.platform !== "win32") {
      await fs.chmod(finalPath, 0o755);
    }
  } finally {
    await fs.unlink(tmpArchive).catch(() => {});
  }

  if (!existsSync(finalPath)) {
    throw new Error(`pi binary not found at ${finalPath} after extraction`);
  }

  await updateManifest("pi", version, finalPath);
  await ensureToolsInPath();
  await writePiProviderConfig(finalPath);
  log.info("[tools] pi installed", { version, path: finalPath });
  return getPiStatus();
}

// ---------------------------------------------------------------------------
// uv + uvx
// Asset: uv-{arch}-{triple}.tar.gz or .zip
// Binary: uv and uvx inside a {arch}-{triple}/ subdir (strip-components=1)
// ---------------------------------------------------------------------------

function resolveUvAsset(release: GitHubRelease): { url: string; isZip: boolean } | null {
  const p = process.platform;
  const arch = process.arch;

  let triple: string;
  if (p === "win32") triple = "x86_64-pc-windows-msvc";
  else if (p === "darwin" && arch === "arm64") triple = "aarch64-apple-darwin";
  else if (p === "darwin") triple = "x86_64-apple-darwin";
  else if (arch === "arm64") triple = "aarch64-unknown-linux-gnu";
  else triple = "x86_64-unknown-linux-gnu";

  const ext = p === "win32" ? ".zip" : ".tar.gz";
  const assetName = `uv-${triple}${ext}`;

  const asset = release.assets.find(a => a.name === assetName && !a.name.endsWith(".sha256"));
  if (!asset) return null;
  return { url: asset.browser_download_url, isZip: ext === ".zip" };
}

export async function getUvStatus(): Promise<ToolInstallStatus> {
  return getToolStatus("uv", "astral-sh", "uv");
}

export async function installOrUpdateUv(): Promise<ToolInstallStatus> {
  log.info("[tools] Installing/updating uv+uvx...");
  const release = await fetchLatestRelease("astral-sh", "uv");
  const asset = resolveUvAsset(release);
  if (!asset) throw new Error(`No uv asset found for ${process.platform}/${process.arch}`);

  const version = release.tag_name.replace(/^v/, "");
  const binDir = getToolsBinDir();
  const uvPath = getToolPath("uv");
  const uvxPath = getToolPath("uvx");
  const tmpArchive = path.join(binDir, `uv-download.${asset.isZip ? "zip" : "tar.gz"}`);

  await fs.mkdir(binDir, { recursive: true });
  log.info("[tools] Downloading uv", { url: asset.url });
  await downloadFile(asset.url, tmpArchive);

  try {
    if (asset.isZip) {
      // uv.exe and uvx.exe inside subdir in zip
      extractFromZip(tmpArchive, binDir, [exeName("uv"), exeName("uvx")]);
    } else {
      // uv and uvx inside subdir in tar.gz → strip-components=1 extracts both
      extractFromTarGz(tmpArchive, binDir, "", 1);
    }

    if (process.platform !== "win32") {
      await fs.chmod(uvPath, 0o755).catch(() => {});
      await fs.chmod(uvxPath, 0o755).catch(() => {});
    }
  } finally {
    await fs.unlink(tmpArchive).catch(() => {});
  }

  if (!existsSync(uvPath)) {
    throw new Error(`uv binary not found at ${uvPath} after extraction`);
  }

  await updateManifest("uv", version, uvPath);
  await ensureToolsInPath();
  log.info("[tools] uv+uvx installed", { version, uvPath, uvxPath });
  return getUvStatus();
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function getToolStatus(
  toolKey: string,
  githubOwner: string,
  githubRepo: string,
): Promise<ToolInstallStatus> {
  const toolPath = getToolPath(toolKey);
  const manifest = await readManifest();
  const entry = manifest[toolKey];
  const installed = existsSync(toolPath);

  let latestVersion: string | null = entry?.version ?? null;
  const now = Date.now();
  const lastChecked = entry ? new Date(entry.lastChecked).getTime() : 0;

  if (now - lastChecked > UPDATE_CHECK_COOLDOWN_MS) {
    try {
      const release = await fetchLatestRelease(githubOwner, githubRepo);
      latestVersion = release.tag_name.replace(/^v/, "");
      if (entry) {
        manifest[toolKey] = { ...entry, lastChecked: new Date().toISOString() };
        await writeManifest(manifest);
      }
    } catch (err) {
      log.warn(`[tools] Could not check ${toolKey} latest version`, err);
    }
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

async function updateManifest(toolKey: string, version: string, toolPath: string): Promise<void> {
  const manifest = await readManifest();
  const now = new Date().toISOString();
  manifest[toolKey] = {
    version,
    installedAt: manifest[toolKey]?.installedAt ?? now,
    lastChecked: now,
    path: toolPath,
  };
  await writeManifest(manifest);
}

// ---------------------------------------------------------------------------
// PATH management
// ---------------------------------------------------------------------------

export async function ensureToolsInPath(): Promise<void> {
  const toolsDir = getToolsBinDir();

  // Always update the current process PATH so child processes (agents) see the tools immediately
  const current = process.env.PATH ?? "";
  if (!current.split(path.delimiter).includes(toolsDir)) {
    process.env.PATH = `${toolsDir}${path.delimiter}${current}`;
  }

  if (process.platform === "win32") {
    ensureWindowsUserPath(toolsDir);
  } else {
    await ensureUnixShellPath(toolsDir);
  }
}

function ensureWindowsUserPath(toolsDir: string): void {
  // Read current user PATH from registry
  const read = spawnSync("powershell", [
    "-NoProfile", "-Command",
    `[Environment]::GetEnvironmentVariable("PATH", "User")`,
  ], { encoding: "utf-8", timeout: 10_000 });

  const current = (read.stdout ?? "").trim();
  const parts = current.split(";").map(p => p.trim()).filter(Boolean);

  if (parts.some(p => p.toLowerCase() === toolsDir.toLowerCase())) return;

  const newPath = [...parts, toolsDir].join(";");
  spawnSync("powershell", [
    "-NoProfile", "-Command",
    `[Environment]::SetEnvironmentVariable("PATH", "${newPath}", "User")`,
  ], { encoding: "utf-8", timeout: 10_000 });

  log.info("[tools] Added tools dir to Windows user PATH", { toolsDir });
}

async function ensureUnixShellPath(toolsDir: string): Promise<void> {
  const shell = path.basename(process.env.SHELL ?? "");
  const exportLine = `export PATH="${toolsDir}:$PATH"`;

  const rcFiles: string[] = [];
  if (shell === "zsh") rcFiles.push(path.join(os.homedir(), ".zshrc"));
  else if (shell === "bash") {
    rcFiles.push(
      process.platform === "darwin"
        ? path.join(os.homedir(), ".bash_profile")
        : path.join(os.homedir(), ".bashrc")
    );
  } else if (shell === "fish") {
    rcFiles.push(path.join(os.homedir(), ".config", "fish", "config.fish"));
  }
  // Always also add to .profile as a fallback
  rcFiles.push(path.join(os.homedir(), ".profile"));

  for (const rcFile of rcFiles) {
    try {
      let content = "";
      try { content = await fs.readFile(rcFile, "utf-8"); } catch {}
      if (content.includes(toolsDir)) continue;
      await fs.mkdir(path.dirname(rcFile), { recursive: true });
      await fs.appendFile(rcFile, `\n# Added by SuperAgent\n${exportLine}\n`);
      log.info("[tools] Added tools dir to shell rc", { rcFile });
    } catch (err) {
      log.warn("[tools] Could not update shell rc", { rcFile, err });
    }
  }
}

// ---------------------------------------------------------------------------
// Pi config.json integration
// ---------------------------------------------------------------------------

async function writePiProviderConfig(piPath: string): Promise<void> {
  try {
    const { resolvePaseoHome } = require("@getpaseo/server") as {
      resolvePaseoHome: (env: NodeJS.ProcessEnv) => string;
    };
    const configPath = path.join(resolvePaseoHome(process.env), "config.json");

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(await fs.readFile(configPath, "utf-8")) as Record<string, unknown>;
    } catch {}

    const agents = (config.agents ?? {}) as Record<string, unknown>;
    const providers = (agents.providers ?? {}) as Record<string, unknown>;

    // Update pi provider path (always set to current install path)
    providers.pi = { command: { mode: "replace", argv: [piPath] } };
    agents.providers = providers;
    config.agents = agents;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
    log.info("[tools] Updated pi provider config", { piPath });
  } catch (err) {
    log.warn("[tools] Could not update pi provider config", err);
  }
}
