#!/usr/bin/env node
// Generates app icons for macOS (.icns), Windows (.ico), and Linux (.png)
// from the source SVG logo. Outputs to build/ directory.

const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const SVG_PATH = path.join(__dirname, '..', 'assets', 'cate-logo.svg')
const BUILD_DIR = path.join(__dirname, '..', 'build')

// Dark background matching the app theme
const BG_COLOR = { r: 30, g: 30, b: 36, alpha: 1 } // #1E1E24

async function createIcon(size) {
  // Logo is 389x204 — scale to fit ~60% of the icon width, centered
  const logoWidth = Math.round(size * 0.6)
  const logoHeight = Math.round(logoWidth * (204 / 389))

  const logo = await sharp(SVG_PATH)
    .resize(logoWidth, logoHeight, { fit: 'contain' })
    .png()
    .toBuffer()

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: logo,
        gravity: 'centre',
      },
    ])
    .png()
    .toBuffer()
}

async function generatePng() {
  const buf = await createIcon(512)
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), buf)
  console.log('  icon.png (512x512)')
}

async function generateIco() {
  const pngToIcoMod = require('png-to-ico')
  const pngToIco = pngToIcoMod.default || pngToIcoMod
  const sizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(sizes.map((s) => createIcon(s)))
  const ico = await pngToIco(pngBuffers)
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), ico)
  console.log('  icon.ico (' + sizes.join(', ') + ')')
}

async function generateIcns() {
  if (process.platform !== 'darwin') {
    console.log('  icon.icns skipped (macOS only)')
    return
  }

  const iconsetDir = path.join(BUILD_DIR, 'icon.iconset')
  fs.mkdirSync(iconsetDir, { recursive: true })

  // macOS iconset requires specific named sizes
  const sizes = [16, 32, 128, 256, 512]
  for (const size of sizes) {
    const buf1x = await createIcon(size)
    fs.writeFileSync(path.join(iconsetDir, `icon_${size}x${size}.png`), buf1x)

    const buf2x = await createIcon(size * 2)
    fs.writeFileSync(
      path.join(iconsetDir, `icon_${size}x${size}@2x.png`),
      buf2x,
    )
  }

  execSync(
    `iconutil -c icns "${iconsetDir}" -o "${path.join(BUILD_DIR, 'icon.icns')}"`,
  )
  fs.rmSync(iconsetDir, { recursive: true })
  console.log('  icon.icns (16–1024)')
}

async function main() {
  fs.mkdirSync(BUILD_DIR, { recursive: true })
  console.log('Generating icons...')
  await Promise.all([generatePng(), generateIco(), generateIcns()])
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
