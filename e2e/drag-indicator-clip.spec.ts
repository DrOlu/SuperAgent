import { test, expect } from '@playwright/test'
import {
  launchApp,
  closeApp,
  seedTerminal,
  resetViewport,
  titleBarCentre,
  getNodeRect,
} from './fixtures/electron-app'
import type { ElectronApplication, Page } from 'playwright'

let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  ;({ electronApp: app, mainWindow: page } = await launchApp())
  // Keep the left sidebar EXPANDED (default) so it occupies real width and the
  // canvas container starts to its right — that left strip is the region the
  // drop indicator must not paint over.
  await page.evaluate(() => window.__cateE2E!.setActiveLeftSidebarView('explorer'))
  await page.waitForTimeout(300) // 200ms width transition + margin
  await resetViewport(page)
})
test.afterEach(async () => closeApp(app))

// The split/zone drop indicator is drawn from the target stack's
// getBoundingClientRect, which ignores the canvas's `overflow-clip`. So a node
// sitting past the canvas's left edge (its left clipped under the sidebar) yields
// an indicator rect that extends under the sidebar, and it's portaled to
// document.body at z-index 10000 with no clipping. The fix clamps the indicator
// to the stack's canvas container, so it can never paint over the sidebar.
test('dock-split indicator is clamped to the canvas, never over the sidebar', async () => {
  // Target node whose origin is LEFT of the canvas edge (negative canvas-x): its
  // DOM rect — and its mini-dock drop-zone rect — extend under the sidebar.
  const target = await seedTerminal(page, { x: -150, y: 420 })
  const source = await seedTerminal(page, { x: 700, y: 420 })
  await resetViewport(page) // re-pin after auto-focus pans
  await page.waitForTimeout(150)

  const tRect = await getNodeRect(page, target)
  const grab = await titleBarCentre(page, source)
  // Aim at the target's real left edge (+12px) → dock-split-left of its mini-dock.
  // That x is under the sidebar, but resolveDockHit uses registered zone rects,
  // not elementFromPoint, so the drop still resolves there.
  await page.mouse.move(grab!.x, grab!.y)
  await page.mouse.down()
  await page.mouse.move(tRect!.x + 12, tRect!.y + tRect!.height / 2, { steps: 25 })
  await page.waitForSelector('[data-drag-indicator]', { state: 'attached', timeout: 2000 })
  await page.waitForTimeout(60)

  const diag = await page.evaluate(() => {
    const ind = document.querySelector('[data-drag-indicator]') as HTMLElement | null
    const sb = document.querySelector('[data-app-sidebar="left"]')!.getBoundingClientRect()
    const r = ind?.getBoundingClientRect() ?? null
    return {
      targetKind: window.__cateE2E!.dragSnapshot().targetKind,
      attr: ind?.getAttribute('data-drag-indicator') ?? null,
      indicatorLeft: r ? r.left : null,
      sidebarRight: sb.right,
    }
  })
  await page.mouse.up()
  await page.waitForTimeout(50)

  expect(diag.targetKind).toBe('dock-split')
  expect(diag.attr).toBe('split-left')
  // The fix: the indicator's left edge is clamped to the canvas edge (= the
  // sidebar's right edge), so it never paints over the sidebar.
  expect(diag.indicatorLeft).not.toBeNull()
  expect(diag.indicatorLeft!).toBeGreaterThanOrEqual(diag.sidebarRight - 1)
})
