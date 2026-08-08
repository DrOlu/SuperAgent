#!/usr/bin/env bash
# Generate all app icons from superagent_logo.svg.
# Runs in the rebrand job (ubuntu) after librsvg2-bin, imagemagick, icnsutils installed.
set -euo pipefail

SVG="${1:-superagent_logo.svg}"
BUILD="build"
ICONS="$BUILD/icons"
SIZES=(16 24 32 48 64 128 256 512 1024)

mkdir -p "$ICONS"

echo "[icons] rendering PNGs from $SVG"
for s in "${SIZES[@]}"; do
  rsvg-convert -w "$s" -h "$s" "$SVG" -o "$ICONS/${s}x${s}.png"
done

# master icon + UI logo
rsvg-convert -w 1024 -h 1024 "$SVG" -o "$BUILD/icon.png"
rsvg-convert -w 512  -h 512  "$SVG" -o "$BUILD/logo.png"

# tray icons (small; electron tray uses ~16-22px, retina 32-44)
rsvg-convert -w 22 -h 22 "$SVG" -o "$BUILD/tray_icon.png"
rsvg-convert -w 22 -h 22 "$SVG" -o "$BUILD/tray_icon_dark.png"
rsvg-convert -w 22 -h 22 "$SVG" -o "$BUILD/tray_icon_light.png"

echo "[icons] building Windows .ico"
if command -v magick >/dev/null 2>&1; then
  ICO_BIN=magick
elif command -v convert >/dev/null 2>&1; then
  ICO_BIN=convert
else
  echo "[icons] WARN: no ImageMagick; skipping .ico" >&2
  ICO_BIN=""
fi
if [ -n "$ICO_BIN" ]; then
  "$ICO_BIN" "$ICONS/16x16.png" "$ICONS/32x32.png" "$ICONS/48x48.png" \
             "$ICONS/64x64.png" "$ICONS/128x128.png" "$ICONS/256x256.png" \
             "$BUILD/icon.ico"
fi

echo "[icons] building macOS .icns"
if command -v png2icns >/dev/null 2>&1; then
  png2icns "$BUILD/icon.icns" "$ICONS/512x512.png"
elif [ -n "$ICO_BIN" ]; then
  "$ICO_BIN" "$ICONS/512x512.png" "$BUILD/icon.icns"
else
  echo "[icons] WARN: no png2icns/magick; skipping .icns" >&2
fi

echo "[icons] done."
ls -la "$BUILD"/*.png "$BUILD"/*.ico "$BUILD"/*.icns 2>/dev/null || true
