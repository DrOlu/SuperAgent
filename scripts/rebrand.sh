#!/usr/bin/env bash
# =============================================================================
# rebrand.sh — Apply SuperAgent branding to a Cate source tree
#
# This script transforms all visible "Cate" references into "SuperAgent" ones.
# It is designed to be idempotent — safe to re-run after merging upstream changes.
#
# Usage: bash scripts/rebrand.sh [repo_root]
#   repo_root defaults to the script's parent directory
# =============================================================================
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

echo "[rebrand] Applying SuperAgent branding in $ROOT ..."

# ── package.json ──────────────────────────────────────────────────────────────
node -e "
const fs = require('fs');
const p = 'package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.name = 'superagent';
j.productName = 'SuperAgent';
j.repository = { type: 'git', url: 'https://github.com/DrOlu/SuperAgent.git' };
j.homepage = 'https://github.com/DrOlu/SuperAgent';
j.bugs = { url: 'https://github.com/DrOlu/SuperAgent/issues' };
j.author = { name: 'Hyperspace', email: 'superagent@hyperspace.ng' };
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
console.log('  package.json');
"

# ── electron-builder.yml ─────────────────────────────────────────────────────
sed -i \
  -e 's|^appId: com\.cate\.app|appId: ng.hyperspace.superagent|' \
  -e 's|^productName: Cate|productName: SuperAgent|' \
  -e 's|  owner: 0-AI-UG|  owner: DrOlu|' \
  -e 's|  repo: cate$|  repo: SuperAgent|' \
  -e "s|NSMicrophoneUsageDescription: Cate needs|NSMicrophoneUsageDescription: SuperAgent needs|" \
  electron-builder.yml
echo '  electron-builder.yml'

# ── index.html ───────────────────────────────────────────────────────────────
sed -i 's|<title>Cate</title>|<title>SuperAgent</title>|' index.html
echo '  index.html'

# ── src/main/index.ts ─────────────────────────────────────────────────────────
sed -i \
  -e "s|app\.setName('Cate')|app.setName('SuperAgent')|" \
  -e "s|app\.setAppUserModelId('com\.cate\.app')|app.setAppUserModelId('ng.hyperspace.superagent')|" \
  -e "s|copyright: \`\© \${new Date()\.getFullYear()} Cate\`|copyright: \`\© \${new Date().getFullYear()} Hyperspace\`|" \
  -e "s|title: 'Cate is not responding'|title: 'SuperAgent is not responding'|" \
  -e "s|title: isDock ? 'Cate' : isPanel ? 'Cate Panel' : 'Cate'|title: isDock ? 'SuperAgent' : isPanel ? 'SuperAgent Panel' : 'SuperAgent'|" \
  -e "s|log\.info('Cate v%s starting|log.info('SuperAgent v%s starting|" \
  src/main/index.ts
echo '  src/main/index.ts'

# ── src/main/menu.ts ─────────────────────────────────────────────────────────
sed -i \
  -e "s|label: 'New Cate Agent'|label: 'New SuperAgent Agent'|" \
  -e "s|label: 'Cate Documentation'|label: 'SuperAgent Documentation'|" \
  -e "s|shell\.openExternal('https://github.com/0-AI-UG/cate')|shell.openExternal('https://github.com/DrOlu/SuperAgent')|" \
  -e "s|shell\.openExternal('https://github.com/0-AI-UG/cate/issues')|shell.openExternal('https://github.com/DrOlu/SuperAgent/issues')|" \
  src/main/menu.ts
echo '  src/main/menu.ts'

# ── src/main/auto-updater.ts ─────────────────────────────────────────────────
# Point the manual "Download latest" fallback (opened by Check for Updates when
# self-update is unavailable) at the SuperAgent downloads page instead of the
# upstream Cate GitHub releases. Drop the now-unused GITHUB_OWNER/GITHUB_REPO
# consts so the next upstream sync can't silently revert the update target.
sed -i \
  -e "s|'Cate can|'SuperAgent can|g" \
  -e "s|Move Cate to Applications|Move SuperAgent to Applications|" \
  -e "s|^const RELEASES_URL = .*|const RELEASES_URL = 'https://superagent.ng/downloads.html'|" \
  -e "/^const GITHUB_OWNER = '0-AI-UG'$/d" \
  -e "/^const GITHUB_REPO = 'cate'$/d" \
  src/main/auto-updater.ts
echo '  src/main/auto-updater.ts'

# ── src/main/auto-updater.test.ts ────────────────────────────────────────────
# Keep the manual-reinstall fallback assertions in lock-step with the rebranded
# RELEASES_URL above, so the next upstream sync can't reintroduce the stale
# `github.com/0-AI-UG/cate/releases` expectation that CI rejects.
sed -i \
  -e "s|expect\.stringContaining('github.com/0-AI-UG/cate/releases')|expect.stringContaining('superagent.ng/downloads.html')|g" \
  src/main/auto-updater.test.ts
echo '  src/main/auto-updater.test.ts'

# ── src/main/workspaceManager.ts ──────────────────────────────────────────────
sed -i \
  -e "s|message: 'Another Cate instance|message: 'Another SuperAgent instance|" \
  -e "s|while another Cate instance|while another SuperAgent instance|" \
  src/main/workspaceManager.ts
echo '  src/main/workspaceManager.ts'

# ── src/main/analytics.ts ────────────────────────────────────────────────────
sed -i \
  -e "s|'User-Agent', \`Cate/|\`User-Agent\`, \`SuperAgent/|" \
  src/main/analytics.ts 2>/dev/null || true
echo '  src/main/analytics.ts'

# ── src/renderer/App.tsx ──────────────────────────────────────────────────────
sed -i \
  -e "s|\${name} \· Cate|\${name} · SuperAgent|" \
  -e "s|: 'Cate'|: 'SuperAgent'|" \
  src/renderer/App.tsx
echo '  src/renderer/App.tsx'

# ── src/renderer/dialogs/WelcomeDialog.tsx ────────────────────────────────────
sed -i \
  -e "s|const GITHUB_REPO = 'https://github.com/0-AI-UG/cate'|const GITHUB_REPO = 'https://github.com/DrOlu/SuperAgent'|" \
  -e "s|const NEWSLETTER_URL = 'https://cate\.cero-ai\.com'|const NEWSLETTER_URL = 'https://hyperspace.ng'|" \
  -e "s|const PRIVACY_URL = 'https://cate\.cero-ai\.com/privacy'|const PRIVACY_URL = 'https://hyperspace.ng/privacy'|" \
  -e 's|Welcome to Cate|Welcome to SuperAgent|' \
  src/renderer/dialogs/WelcomeDialog.tsx
echo '  src/renderer/dialogs/WelcomeDialog.tsx'
# ── src/renderer/dialogs/WelcomeDialog.test.tsx ──────────────────────
sed -i \
  -e 's|Welcome to Cate|Welcome to SuperAgent|' \
  src/renderer/dialogs/WelcomeDialog.test.tsx
echo '  src/renderer/dialogs/WelcomeDialog.test.tsx'

# ── src/renderer/dialogs/PostUpdateFeedbackDialog.tsx ────────────────────────
sed -i \
  -e "s|const GITHUB_REPO = 'https://github.com/0-AI-UG/cate'|const GITHUB_REPO = 'https://github.com/DrOlu/SuperAgent'|" \
  -e "s|const GITHUB_API = 'https://api\.github\.com/repos/0-AI-UG/cate'|const GITHUB_API = 'https://api.github.com/repos/DrOlu/SuperAgent'|" \
  -e "s|const NEWSLETTER_URL = 'https://cate\.cero-ai\.com'|const NEWSLETTER_URL = 'https://hyperspace.ng'|" \
  -e 's|Welcome to Cate|Welcome to SuperAgent|' \
  -e 's|>CATE<|>SuperAgent<|' \
  -e 's|"CATE"|"SuperAgent"|' \
  src/renderer/dialogs/PostUpdateFeedbackDialog.tsx
echo '  src/renderer/dialogs/PostUpdateFeedbackDialog.tsx'

# ── src/renderer/settings/ ───────────────────────────────────────────────────
sed -i 's|while Cate is in focus|while SuperAgent is in focus|' \
  src/renderer/settings/NotificationSettings.tsx
sed -i "s|Zooms Cate's interface|Zooms SuperAgent's interface|" \
  src/renderer/settings/AppearanceSettings.tsx
echo '  src/renderer/settings/'

# ── src/renderer/ui/CommandPalette.tsx ───────────────────────────────────────
sed -i "s|title: 'New Cate Agent'|title: 'New SuperAgent Agent'|" \
  src/renderer/ui/CommandPalette.tsx
echo '  src/renderer/ui/CommandPalette.tsx'

# ── src/renderer/canvas/ ────────────────────────────────────────────────────
sed -i "s|label: 'New Cate agent'|label: 'New SuperAgent agent'|" \
  src/renderer/canvas/Canvas.tsx
sed -i 's|title="Cate agent"|title="SuperAgent agent"|' \
  src/renderer/canvas/CanvasToolbar.tsx
sed -i 's|title="Cate agent"|title="SuperAgent agent"|' \
  src/renderer/canvas/WorktreeToolbarMenu.tsx
echo '  src/renderer/canvas/'

# ── src/renderer/onboarding/steps.ts ────────────────────────────────────────
sed -i \
  -e 's|or Cate agent from|or SuperAgent agent from|' \
  -e 's|get around Cate|get around SuperAgent|' \
  src/renderer/onboarding/steps.ts
echo '  src/renderer/onboarding/steps.ts'

# ── src/renderer/stores/useParallelWork.ts ──────────────────────────────────
sed -i 's|or Cate agent bound|or SuperAgent agent bound|' \
  src/renderer/stores/useParallelWork.ts
echo '  src/renderer/stores/useParallelWork.ts'

# ── src/shared/ ──────────────────────────────────────────────────────────────
sed -i "s|label: 'Cate Agent'|label: 'SuperAgent Agent'|" \
  src/shared/panels.ts
sed -i "s|newAgent: 'New Cate Agent'|newAgent: 'New SuperAgent Agent'|" \
  src/shared/types.ts
sed -i "s|label: 'Cate Agent'|label: 'SuperAgent Agent'|" \
  src/shared/skills.ts
echo '  src/shared/'

# ── Theme authors ────────────────────────────────────────────────────────────
find src/shared/themes -name '*.ts' -exec sed -i "s|author: 'Cate theme pack'|author: 'SuperAgent theme pack'|g" {} +
echo '  src/shared/themes/'

# ── src/agent/ ────────────────────────────────────────────────────────────────
if [ -f src/agent/renderer/AgentSettingsView.tsx ]; then
  sed -i 's|not supported in Cate yet|not supported in SuperAgent yet|' \
    src/agent/renderer/AgentSettingsView.tsx
fi
if [ -f src/agent/main/marketplace.ts ]; then
  sed -i "s|'user-agent': 'Cate/marketplace|'user-agent': 'SuperAgent/marketplace|" \
    src/agent/main/marketplace.ts
  sed -i 's|from Cate is not supported|from SuperAgent is not supported|' \
    src/agent/main/marketplace.ts
fi
echo '  src/agent/'

# ── src/skills/ ───────────────────────────────────────────────────────────────
if [ -f src/skills/main/githubCrawl.ts ]; then
  sed -i "s|'User-Agent': 'Cate-skills'|'User-Agent': 'SuperAgent-skills'|g" \
    src/skills/main/githubCrawl.ts
fi
if [ -f src/skills/main/skillsRegistry.ts ]; then
  sed -i "s|'User-Agent': 'Cate-skills'|'User-Agent': 'SuperAgent-skills'|g" \
    src/skills/main/skillsRegistry.ts
fi
echo '  src/skills/'

# ── scripts/patch-electron-name.sh ───────────────────────────────────────────
sed -i \
  -e 's|CFBundleDisplayName Cate|CFBundleDisplayName SuperAgent|' \
  -e 's|CFBundleName Cate|CFBundleName SuperAgent|' \
  scripts/patch-electron-name.sh
echo '  scripts/patch-electron-name.sh'

# ── scripts/generate-icons.js ────────────────────────────────────────────────
sed -i \
  -e "s|cate-logo\.svg|superagent-logo.svg|" \
  -e 's|Logo is 389x204|SuperAgent logo is 512x512|' \
  -e 's|const logoWidth = Math.round(size \* 0\.6)|const logoWidth = Math.round(size * 0.85)|' \
  -e 's|const logoHeight = Math.round(logoWidth \* (204 / 389))|const logoHeight = Math.round(logoWidth)|' \
  scripts/generate-icons.js
echo '  scripts/generate-icons.js'

# ── SuperAgent logo SVG ─────────────────────────────────────────────────────
# Copy the SuperAgent logo SVG into assets/ if not already present
SA_LOGO="${ROOT}/assets/superagent-logo.svg"
if [ ! -f "$SA_LOGO" ]; then
  cat > "$SA_LOGO" << 'SVGEOF'
<svg width="32" height="32" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z" fill="#CC1100"/>
<path d="M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z" fill="#FFFFFF"/>
</svg>
SVGEOF
  echo '  assets/superagent-logo.svg (created)'
fi

# Also copy to renderer assets
RENDERER_LOGO="${ROOT}/src/renderer/assets/superagent-logo.svg"
if [ ! -f "$RENDERER_LOGO" ]; then
  cp "$SA_LOGO" "$RENDERER_LOGO"
  echo '  src/renderer/assets/superagent-logo.svg (copied)'
fi

# ── CateLogo.tsx — replace with SuperAgent logo SVG ──────────────────────────
cat > src/renderer/ui/CateLogo.tsx << 'LOGOEOF'
import type { ComponentProps } from 'react'

interface CateLogoProps extends ComponentProps<'svg'> {
  size?: number
  weight?: string
}

export function CateLogo({ size = 24, className, weight: _weight, ...rest }: CateLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <path d="M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z" fill="currentColor"/>
      <path d="M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z" fill="#FFFFFF"/>
    </svg>
  )
}
LOGOEOF
echo '  src/renderer/ui/CateLogo.tsx'

# ── WelcomePage.tsx — replace inline SVG logo ────────────────────────────────
# Replace the old CATE letter paths with SuperAgent logo paths
sed -i 's|viewBox="0 0 389 204" className="h-8 text-primary mb-2"|viewBox="0 0 512 512" className="h-8 text-primary mb-2"|' \
  src/renderer/ui/WelcomePage.tsx
# Replace the old CATE SVG paths with SuperAgent logo (the 4 path elements)
# This is complex — use a Node script for precision
node -e "
const fs = require('fs');
const f = 'src/renderer/ui/WelcomePage.tsx';
let s = fs.readFileSync(f, 'utf8');
// Replace the old CATE SVG content with SuperAgent logo
s = s.replace(
  /<svg viewBox=\"0 0 512 512\" className=\"h-8 text-primary mb-2\" fill=\"currentColor\" xmlns=\"http:\/\/www\.w3\.org\/2000\/svg\">[\s\S]*?<\/svg>/,
  '<svg viewBox=\"0 0 512 512\" className=\"h-8 text-primary mb-2\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n            <path d=\"M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z\" fill=\"currentColor\"/>\n            <path d=\"M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z\" fill=\"#FFFFFF\"/>\n          </svg>'
);
fs.writeFileSync(f, s);
console.log('  src/renderer/ui/WelcomePage.tsx (SVG replaced)');
"

# ── Sidebar.tsx — replace inline SVG logo ────────────────────────────────────
node -e "
const fs = require('fs');
const f = 'src/renderer/sidebar/Sidebar.tsx';
let s = fs.readFileSync(f, 'utf8');
// Replace the old CATE SVG with SuperAgent logo, updating viewBox and aria-label
const oldSvg = /<svg viewBox=\"0 0 [0-9]+ [0-9]+\" className=\"h-3 w-auto text-secondary\"[^\n]*aria-label=\"[^\"]*\">[\s\S]*?<\/svg>/;
const newSvg = '<svg viewBox=\"0 0 512 512\" className=\"h-3 w-auto text-secondary\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" aria-label=\"SuperAgent\">\n            <path d=\"M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z\" fill=\"currentColor\"/>\n            <path d=\"M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z\" fill=\"#FFFFFF\"/>\n          </svg>';
if (oldSvg.test(s)) {
  s = s.replace(oldSvg, newSvg);
  fs.writeFileSync(f, s);
  console.log('  src/renderer/sidebar/Sidebar.tsx (SVG replaced)');
} else {
  console.log('  src/renderer/sidebar/Sidebar.tsx (already branded or pattern changed)');
}
"

# ── index.html — replace splash screen SVG ───────────────────────────────────
node -e "
const fs = require('fs');
const f = 'index.html';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(
  /<svg viewBox=\"[^\"]*\" fill=\"none\" xmlns=\"http:\/\/www\.w3\.org\/2000\/svg\" style=\"height:32px;color:#6b6762\">[\s\S]*?<\/svg>/,
  '<svg viewBox=\"0 0 512 512\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\" style=\"height:32px;color:#6b6762\">\n        <path d=\"M80,0 H432 A80,80,0,0,1,512,80 V432 A80,80,0,0,1,432,512 H80 A80,80,0,0,1,0,432 V80 A80,80,0,0,1,80,0 Z\" fill=\"currentColor\"/>\n        <path d=\"M180.6,373.2 C196.4,376.3 216.1,377.3 233.2,377.3 C281.1,377.3 343.4,367.2 343.4,304.9 C343.4,283.5 334.4,269.1 320.3,258.3 C300.2,242.9 271.8,234.9 250.3,225.5 C235.2,218.8 224.2,211.8 224.2,200.4 C224.2,181.3 247.6,174.3 283.5,174.3 C298.2,174.3 312.6,175.6 327.4,178.6 L327.4,138.8 C312.3,135.7 297.2,134.7 281.8,134.7 C233.9,134.7 168.2,144.8 168.2,207.1 C168.2,228.5 177.3,242.9 191.3,253.7 C211.4,269.1 239.9,277.1 261.4,286.5 C276.4,293.2 287.5,300.2 287.5,311.6 C287.5,330.7 264.0,337.7 228.2,337.7 C213.5,337.7 199.1,336.4 184.3,333.4 L184.3,373.2 Z\" fill=\"currentColor\" opacity=\"0.3\"/>\n      </svg>'
);
fs.writeFileSync(f, s);
console.log('  index.html (splash SVG replaced)');
"

echo ""
echo "[rebrand] Done. All visible 'Cate' references replaced with 'SuperAgent'."
echo "[rebrand] Internal code references (function names, env vars, etc.) are preserved."
