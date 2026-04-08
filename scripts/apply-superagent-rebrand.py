"""
SuperAgent rebrand script - applies all known-working visual changes to a fresh paseo checkout.
This is the single source of truth for the rebrand. Run from repo root.
"""
import os, shutil, json, glob

BASE = '/tmp/paseo-fresh'
ICONS = '/tmp/superagent-icons'

def replace_in(path, replacements):
    with open(os.path.join(BASE, path), 'r', encoding='utf-8') as f:
        c = f.read()
    for old, new in replacements:
        c = c.replace(old, new)
    with open(os.path.join(BASE, path), 'w', encoding='utf-8') as f:
        f.write(c)

# ── 1. app.config.js: ONLY change visible app name ──
replace_in('packages/app/app.config.js', [
    ('name: "Paseo"', 'name: "SuperAgent"'),
    ('name: "Paseo Debug"', 'name: "SuperAgent Debug"'),
])

# ── 2. In-app logo (paseo-logo.tsx) ──
LOGO = '''import Svg, { Path } from "react-native-svg";
import { useUnistyles } from "react-native-unistyles";

interface PaseoLogoProps {
  size?: number;
  color?: string;
}

export function PaseoLogo({ size = 64 }: PaseoLogoProps) {
  useUnistyles();

  return (
    <Svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <Path
        d="M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z"
        fill="#CC1100"
      />
      <Path
        d="M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}
'''
with open(os.path.join(BASE, 'packages/app/src/components/icons/paseo-logo.tsx'), 'w') as f:
    f.write(LOGO)

# ── 3. UI text strings ──
replace_in('packages/app/src/components/welcome-screen.tsx', [
    ('Welcome to Paseo', 'Welcome to SuperAgent'),
])
replace_in('packages/app/src/screens/startup-splash-screen.tsx', [
    ('Welcome to Paseo', 'Welcome to SuperAgent'),
    ('https://github.com/getpaseo/paseo/issues/new', 'https://github.com/DrOlu/SuperAgent/issues/new'),
])
replace_in('packages/app/src/screens/settings-screen.tsx', [
    ('"This updates Paseo on this computer."', '"This updates SuperAgent on this computer."'),
    ('"This host is offline. Paseo reconnects automatically', '"This host is offline. SuperAgent reconnects automatically'),
    ('"Failed to send the restart request. Paseo reconnects automatically', '"Failed to send the restart request. SuperAgent reconnects automatically'),
])
replace_in('packages/app/src/desktop/components/desktop-updates-section.tsx', [
    ('"Enabled. Paseo can manage the built-in daemon from the desktop app."', '"Enabled. SuperAgent can manage the built-in daemon from the desktop app."'),
    ('title="Add paseo to your shell"', 'title="Add SuperAgent to your shell"'),
    ('Paseo does not add the command for you.', 'SuperAgent does not add the command for you.'),
    ('Scan this QR code in Paseo, or copy the pairing link below.', 'Scan this QR code in SuperAgent, or copy the pairing link below.'),
])
replace_in('packages/app/src/desktop/permissions/use-desktop-permissions.ts', [
    ('title: "Paseo notification test"', 'title: "SuperAgent notification test"'),
])
replace_in('packages/app/src/desktop/updates/update-banner.tsx', [
    ('const CHANGELOG_URL = "https://paseo.sh/changelog";', 'const CHANGELOG_URL = "https://github.com/DrOlu/SuperAgent/releases";'),
])
replace_in('packages/app/src/components/agent-form/agent-form-dropdowns.tsx', [
    ('"Pick a Paseo worktree by branch"', '"Pick a SuperAgent worktree by branch"'),
])

# ── 4. Desktop main.ts ──
replace_in('packages/desktop/src/main.ts', [
    ('app.setName("Paseo");', 'app.setName("SuperAgent");'),
])

# ── 5. daemon-manager.ts: visible strings + use app version for update check ──
replace_in('packages/desktop/src/daemon/daemon-manager.ts', [
    ('detail: "Create a symlink to the bundled Paseo CLI shim."', 'detail: "Create a symlink to the bundled SuperAgent CLI shim."'),
    ('detail: "Add the Paseo installation directory to your system PATH so paseo.cmd is available."', 'detail: "Add the SuperAgent installation directory to your system PATH so superagent.cmd is available."'),
])
# Fix update check to use app version not daemon version
p = os.path.join(BASE, 'packages/desktop/src/daemon/daemon-manager.ts')
with open(p) as f: c = f.read()
c = c.replace(
    'check_app_update: async () => {\n      const currentVersion = await resolveCurrentUpdateVersion();\n      return checkForAppUpdate(currentVersion);',
    'check_app_update: async () => {\n      const currentVersion = resolveDesktopAppVersion();\n      return checkForAppUpdate(currentVersion);'
)
with open(p, 'w') as f: f.write(c)

# ── 6. auto-updater.ts: normalize version comparison ──
replace_in('packages/desktop/src/features/auto-updater.ts', [
    ('    const hasUpdate = latestVersion !== currentVersion;',
     "    const normalizeVer = (v: string) => v.replace(/^v/i, '').trim();\n    const hasUpdate = normalizeVer(latestVersion) !== normalizeVer(currentVersion);"),
])

# ── 7. after-pack.js: executable name ──
replace_in('packages/desktop/scripts/after-pack.js', [
    ('const EXECUTABLE_NAME = "Paseo";', 'const EXECUTABLE_NAME = "SuperAgent";'),
])

# ── 8. electron-builder.yml ──
replace_in('packages/desktop/electron-builder.yml', [
    ('appId: sh.paseo.desktop', 'appId: ng.hyperspace.superagent'),
    ('productName: Paseo', 'productName: SuperAgent'),
    ('executableName: Paseo', 'executableName: SuperAgent'),
    ('owner: getpaseo', 'owner: DrOlu'),
    ('repo: paseo', 'repo: SuperAgent'),
    ('artifactName: "Paseo-', 'artifactName: "SuperAgent-'),
    ('maintainer: "Mohamed Boudra <hello@moboudra.com>"', 'maintainer: "Hyperspace Technologies <superagent@hyperspace.ng>"'),
    ('vendor: "Paseo"', 'vendor: "SuperAgent by Hyperspace Technologies"'),
    ('hardenedRuntime: true', 'hardenedRuntime: false'),
    ('notarize: true', 'notarize: false'),
])
# Add identity: null and remove entitlements for mac
p = os.path.join(BASE, 'packages/desktop/electron-builder.yml')
with open(p) as f: c = f.read()
c = c.replace('  notarize: false\n  entitlements: build/entitlements.mac.plist\n  entitlementsInherit: build/entitlements.mac.inherit.plist',
              '  notarize: false\n  identity: null')
with open(p, 'w') as f: f.write(c)

# ── 9. bin/paseo and bin/paseo.cmd: executable name ──
p = os.path.join(BASE, 'packages/desktop/bin/paseo')
with open(p) as f: c = f.read()
c = c.replace('MacOS/Paseo', 'MacOS/SuperAgent')
c = c.replace('"${RESOURCES_DIR}/../Paseo"', '"${RESOURCES_DIR}/../SuperAgent"')
c = c.replace('Bundled Paseo executable', 'Bundled SuperAgent executable')
with open(p, 'w') as f: f.write(c)

p = os.path.join(BASE, 'packages/desktop/bin/paseo.cmd')
with open(p) as f: c = f.read()
c = c.replace('Paseo.exe', 'SuperAgent.exe')
c = c.replace('Bundled Paseo', 'Bundled SuperAgent')
with open(p, 'w') as f: f.write(c)

# ── 10. desktop/package.json: author, description, repo ──
p = os.path.join(BASE, 'packages/desktop/package.json')
with open(p) as f: pkg = json.load(f)
pkg['description'] = 'SuperAgent desktop app (Electron wrapper)'
pkg['homepage'] = 'https://hyperspace.ng'
pkg['author'] = {'name': 'Hyperspace Technologies', 'email': 'superagent@hyperspace.ng'}
if 'repository' in pkg and 'url' in pkg['repository']:
    pkg['repository']['url'] = 'https://github.com/DrOlu/SuperAgent.git'
with open(p, 'w') as f: json.dump(pkg, f, indent=2); f.write('\n')

# ── 11. root package.json: author ──
p = os.path.join(BASE, 'package.json')
with open(p) as f: pkg = json.load(f)
pkg['author'] = {'name': 'Hyperspace Technologies', 'email': 'superagent@hyperspace.ng'}
pkg['homepage'] = 'https://hyperspace.ng'
with open(p, 'w') as f: json.dump(pkg, f, indent=2); f.write('\n')

# ── 12. README.md ──
replace_in('README.md', [
    ('# Paseo', '# SuperAgent'),
    ('Paseo', 'SuperAgent'),
    ('getpaseo', 'DrOlu'),
    ('paseo.sh', 'hyperspace.ng'),
])

# ── 13. Replace icon files ──
icon_map = {
    'packages/desktop/assets/icon.png': 'icon.png',
    'packages/desktop/assets/icon.ico': 'icon.ico',
    'packages/desktop/assets/icon.icns': 'icon.icns',
    'packages/desktop/assets/128x128@2x.png': 'icon_256.png',
    'packages/desktop/assets/128x128.png': 'icon_128.png',
    'packages/desktop/assets/64x64.png': 'icon_64.png',
    'packages/desktop/assets/32x32.png': 'icon_32.png',
    'packages/app/assets/images/icon.png': 'icon.png',
    'packages/app/assets/images/favicon.png': 'icon_256.png',
    'packages/app/assets/images/splash-icon.png': 'icon.png',
    'packages/app/assets/images/notification-icon.png': 'icon.png',
    'packages/app/assets/images/android-icon-foreground.png': 'icon.png',
}
for dest, src in icon_map.items():
    src_path = os.path.join(ICONS, src)
    dst_path = os.path.join(BASE, dest)
    if os.path.exists(src_path):
        shutil.copy2(src_path, dst_path)

# Replace SVG favicons and PNG favicons in app images
svg_icon = os.path.join(ICONS, 'icon-s.svg')
for f in glob.glob(os.path.join(BASE, 'packages/app/assets/images/*.svg')):
    if os.path.exists(svg_icon):
        shutil.copy2(svg_icon, f)
for f in glob.glob(os.path.join(BASE, 'packages/app/assets/images/favicon*.png')):
    shutil.copy2(os.path.join(ICONS, 'icon_256.png'), f)

# ── 14. Website icons ──
WEBSITE_LOGO = '''<svg width="32" height="32" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z" fill="#CC1100"/>
<path d="M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z" fill="#FFFFFF"/>
</svg>'''
with open(os.path.join(BASE, 'packages/website/public/logo.svg'), 'w') as f: f.write(WEBSITE_LOGO)
with open(os.path.join(BASE, 'packages/website/public/favicon.svg'), 'w') as f:
    f.write(WEBSITE_LOGO.replace('width="32" height="32"', 'width="48" height="48"'))
shutil.copy2(os.path.join(ICONS, 'icon.ico'), os.path.join(BASE, 'packages/website/public/favicon.ico'))

# ── 15. Website download URLs and text ──
replace_in('packages/website/src/downloads.tsx', [
    ('https://github.com/getpaseo/paseo/releases/download/v${desktopVersion}', 'https://github.com/DrOlu/SuperAgent/releases/download/v${desktopVersion}'),
    ('/Paseo-${desktopVersion}', '/SuperAgent-${desktopVersion}'),
    ('/Paseo-Setup-${desktopVersion}', '/SuperAgent-Setup-${desktopVersion}'),
])

# Website visible text
import pathlib
for f in pathlib.Path(os.path.join(BASE, 'packages/website/src')).rglob('*.tsx'):
    try:
        with open(f) as fh: c = fh.read()
        orig = c
        c = c.replace('Paseo', 'SuperAgent')
        c = c.replace('getpaseo/paseo', 'DrOlu/SuperAgent')
        c = c.replace('paseo.sh', 'hyperspace.ng')
        if c != orig:
            with open(f, 'w') as fh: fh.write(c)
    except: pass

# -- Windows daemon kill fix: use taskkill instead of SIGTERM --
p = os.path.join(BASE, 'packages/desktop/src/daemon/daemon-manager.ts')
with open(p) as f: dm = f.read()
old_sig = 'function signalProcessSafely(pid: number, signal: NodeJS.Signals): boolean {\n  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return false;\n  try {\n    process.kill(pid, signal);'
new_sig = 'function signalProcessSafely(pid: number, signal: NodeJS.Signals): boolean {\n  if (!Number.isInteger(pid) || pid <= 1 || pid === process.pid) return false;\n  if (process.platform === "win32") {\n    try {\n      const { spawnSync: _spawnSyncKill } = require("node:child_process");\n      const result = _spawnSyncKill("taskkill", ["/F", "/PID", String(pid)], { stdio: ["ignore","ignore","ignore"] });\n      return result.status === 0;\n    } catch { return false; }\n  }\n  try {\n    process.kill(pid, signal);'
if old_sig in dm and new_sig not in dm:
    dm = dm.replace(old_sig, new_sig)
    with open(p, 'w') as f: f.write(dm)

# -- Integrations section URL fix (paseo.sh -> hyperspace.ng) --
replace_in('packages/app/src/desktop/components/integrations-section.tsx', [
    ('https://paseo.sh/docs/cli', 'https://hyperspace.ng/docs/cli'),
    ('https://paseo.sh/docs/skills', 'https://hyperspace.ng/docs/skills'),
])

print('✅ All SuperAgent rebrand changes applied')
