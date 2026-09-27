#!/usr/bin/env bash
# SuperAgent UI overlay — re-applies the brand theme after an upstream sync.
#
# The sync pipeline replaces the whole tree with fresh SuperAgent (+rebrand),
# so every SuperAgent UI enhancement must be re-planted here. Idempotent:
# each edit is skipped gracefully when its target pattern is absent (e.g.
# upstream refactored the file) — a warning is printed instead of failing.
#
# Usage: scripts/superagent-ui-overlay.sh <keep-dir>
#   <keep-dir> holds the files saved by the sync job's "Save preserved files"
#   step (gellix fonts, gellix.css, openship.css, brand-contract test).
set -uo pipefail

KEEP="${1:?usage: superagent-ui-overlay.sh <keep-dir>}"
warn() { echo "[ui-overlay] WARN: $*" >&2; }

# ── whole-file restorations ────────────────────────────────────────────────
mkdir -p src/renderer/assets/fonts/gellix src/renderer/assets/styles packages/ui/scripts/__tests__
if [ -d "$KEEP/gellix-fonts" ]; then
  cp -a "$KEEP/gellix-fonts/." src/renderer/assets/fonts/gellix/
else
  warn "gellix fonts missing from keep dir"
fi
for f in gellix.css openship.css; do
  if [ -f "$KEEP/styles/$f" ]; then cp "$KEEP/styles/$f" src/renderer/assets/styles/; else warn "$f missing"; fi
done
if [ -f "$KEEP/brand-contract/brand-contract.test.ts" ]; then
  cp "$KEEP/brand-contract/brand-contract.test.ts" packages/ui/scripts/__tests__/
else
  warn "brand-contract test missing"
fi
mkdir -p src/renderer/assets/styles/__tests__
if [ -f "$KEEP/brand-gradient/brandGradient.test.ts" ]; then
  cp "$KEEP/brand-gradient/brandGradient.test.ts" src/renderer/assets/styles/__tests__/
else
  warn "brandGradient test missing"
fi

apply() { # apply <file> <old> <new> <label>
  local file="$1" old="$2" new="$3" label="$4"
  if [ ! -f "$file" ]; then warn "$label: $file missing"; return 0; fi
  # exact containment + replace handled in python: grep -F would treat a
  # multi-line pattern as alternative single-line patterns (wrong semantics)
  python3 - "$file" "$old" "$new" "$label" <<'PY'
import sys
path, old, new, label = sys.argv[1:5]
s = open(path).read()
if (new in s) if new else (old not in s):
    sys.exit(0)  # already applied (or nothing left to remove)
if old not in s:
    print(f"[ui-overlay] WARN: {label}: pattern drifted in {path}", file=sys.stderr)
    sys.exit(0)
open(path, "w").write(s.replace(old, new, 1))
print(f"[ui-overlay] {label} applied")
PY
}

# ── token edits (upstream-owned files, patched in place) ───────────────────
GREEN_RAMP='  /* Brand (SuperAgent ) */
  --cs-brand-50: oklch(0.98 0.015 152);
  --cs-brand-100: oklch(0.96 0.034 151);
  --cs-brand-200: oklch(0.91 0.073 151);
  --cs-brand-300: oklch(0.85 0.13 149);
  --cs-brand-400: oklch(0.81 0.173 148);
  --cs-brand-500: oklch(0.77 0.208 146);
  --cs-brand-600: oklch(0.67 0.192 146);
  --cs-brand-700: oklch(0.56 0.156 146);
  --cs-brand-800: oklch(0.43 0.117 146);
  --cs-brand-900: oklch(0.3 0.075 147);
  --cs-brand-950: oklch(0.22 0.051 148);
}'
RED_RAMP='  /* Brand (SuperAgent) — the confirm_original.png mark, #CC1100.
     brand-500 is the exact logo red (oklch ~0.545 0.226 29). */
  --cs-brand-50: oklch(0.98 0.015 32);
  --cs-brand-100: oklch(0.96 0.038 31);
  --cs-brand-200: oklch(0.91 0.083 30);
  --cs-brand-300: oklch(0.85 0.145 30);
  --cs-brand-400: oklch(0.72 0.2 29);
  --cs-brand-500: oklch(0.545 0.226 29);
  --cs-brand-600: oklch(0.47 0.21 29);
  --cs-brand-700: oklch(0.42 0.19 29);
  --cs-brand-800: oklch(0.36 0.16 29);
  --cs-brand-900: oklch(0.3 0.13 29);
  --cs-brand-950: oklch(0.22 0.09 29);
}'
apply packages/ui/src/styles/tokens/colors/primitive.css "$GREEN_RAMP" "$RED_RAMP" "brand ramp #CC1100"

apply packages/ui/src/styles/tokens/typography.css \
  "  --cs-font-family-heading: Inter;
  --cs-font-family-body: Inter;" \
  "  --cs-font-family-heading: 'Gellix', Inter, system-ui, -apple-system, sans-serif;
  --cs-font-family-body: 'Gellix', Inter, system-ui, -apple-system, sans-serif;" \
  "Gellix font stack"

if [ -f src/renderer/assets/styles/index.css ] && ! grep -q "gellix.css" src/renderer/assets/styles/index.css; then
  if grep -qE "@import" src/renderer/assets/styles/index.css; then
    python3 - <<'PY'
import re
p = "src/renderer/assets/styles/index.css"
s = open(p).read()
m = re.search(r"@import [^\n]+\n", s)
s = s.replace(m.group(0), m.group(0) + "@import './gellix.css' layer(app);\n@import './openship.css' layer(app);\n", 1)
open(p, "w").write(s)
PY
    echo "[ui-overlay] index.css imports applied"
  else
    warn "index.css: no @import lines"
  fi
fi

apply src/renderer/components/composer/tools/toolbarManifests.tsx \
  '<Pointer size={18} color="#00b96b" />' \
  '<Pointer size={18} color="var(--cs-brand-600)" />' \
  "toolbar accent token"

apply src/renderer/components/tags/Model/VisionTag.tsx \
  'color="#00b96b"' 'color="var(--cs-brand-600)"' "VisionTag accent token"

apply src/renderer/pages/settings/AppearanceSettings/AppearanceSettings.tsx \
  "const DEFAULT_COLOR_PRIMARY = '#00b96b'" \
  "const DEFAULT_COLOR_PRIMARY = '#CC1100'" \
  "default accent #CC1100"

# Provider settings visibility: upstream's botched sync clause hides every
# provider except 'cherryin' from the settings list — which also misroutes
# the Claude Code runtime to the wrong endpoint (403 on auth). Never ship it.
apply src/renderer/utils/providerSettings.ts \
  " && provider.id === 'cherryin'" \
  "" \
  "provider settings visibility (de-cherryin)"

apply src/shared/data/preference/preferenceSchemas.ts \
  "'ui.theme_user.color_primary': '#00b96b'," \
  "'ui.theme_user.color_primary': '#CC1100'," \
  "preference default color_primary"

echo "[ui-overlay] done"
