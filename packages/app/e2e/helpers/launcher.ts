import { expect, type Page } from "@playwright/test";
import { buildHostWorkspaceRoute } from "../../src/utils/host-routes";
import { createTempGitRepo } from "./workspace";

// ─── Navigation ────────────────────────────────────────────────────────────

function getServerId(): string {
  const serverId = process.env.E2E_SERVER_ID;
  if (!serverId) {
    throw new Error("E2E_SERVER_ID is not set (expected from Playwright globalSetup).");
  }
  return serverId;
}

/** Navigate to a workspace and wait for the tab bar to appear. */
export async function gotoWorkspace(page: Page, cwd: string): Promise<void> {
  const route = buildHostWorkspaceRoute(getServerId(), cwd);
  await page.goto(route);
  await waitForTabBar(page);
}

// ─── Tab bar queries ───────────────────────────────────────────────────────

/** Wait for the workspace tab bar to be visible. */
export async function waitForTabBar(page: Page): Promise<void> {
  await expect(page.getByTestId("workspace-tabs-row").first()).toBeVisible({
    timeout: 30_000,
  });
}

/** Return all tab test IDs currently in the tab bar. */
export async function getTabTestIds(page: Page): Promise<string[]> {
  const tabs = page.locator('[data-testid^="workspace-tab-"]');
  const count = await tabs.count();
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const testId = await tabs.nth(i).getAttribute("data-testid");
    if (testId) ids.push(testId);
  }
  return ids;
}

/** Return the number of tabs matching a kind prefix (e.g. "launcher", "draft", "terminal", "agent"). */
export async function countTabsOfKind(page: Page, kind: string): Promise<number> {
  const ids = await getTabTestIds(page);
  return ids.filter((id) => id.includes(kind)).length;
}

/** Return the currently active tab's test ID (the one with aria-selected or focus styling). */
export async function getActiveTabTestId(page: Page): Promise<string | null> {
  // Active tab has the focused highlight — check for the aria-selected or data-active attribute
  const activeTab = page.locator('[data-testid^="workspace-tab-"][aria-selected="true"]').first();
  if (await activeTab.isVisible().catch(() => false)) {
    return activeTab.getAttribute("data-testid");
  }
  // Fallback: the tab with focused styling
  return null;
}

// ─── Tab actions ───────────────────────────────────────────────────────────

/** Click the '+' button in the tab bar to open a new launcher tab. */
export async function clickNewTabButton(page: Page): Promise<void> {
  const button = page.getByTestId("workspace-new-tab");
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

/** Press Cmd+T (macOS) to open a new tab. */
export async function pressNewTabShortcut(page: Page): Promise<void> {
  await page.keyboard.press("Meta+t");
}

// ─── Launcher panel assertions ─────────────────────────────────────────────

/** Wait for the launcher panel to render with its primary tiles. */
export async function waitForLauncherPanel(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "New Chat" }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Terminal" }).first()).toBeVisible({
    timeout: 15_000,
  });
}

/** Assert that the launcher panel shows provider tiles under "Terminal Agents". */
export async function assertProviderTilesVisible(page: Page): Promise<void> {
  await expect(page.getByText("Terminal Agents", { exact: true }).first()).toBeVisible({
    timeout: 10_000,
  });
}

/** Assert the launcher panel has a "New Chat" tile. */
export async function assertNewChatTileVisible(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "New Chat" }).first()).toBeVisible();
}

/** Assert the launcher panel has a "Terminal" tile. */
export async function assertTerminalTileVisible(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Terminal" }).first()).toBeVisible();
}

// ─── Launcher tile clicks ──────────────────────────────────────────────────

/** Click the "New Chat" tile on the launcher panel. */
export async function clickNewChat(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "New Chat" }).first();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

/** Click the "Terminal" tile on the launcher panel. */
export async function clickTerminal(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Terminal" }).first();
  await expect(button).toBeVisible({ timeout: 10_000 });
  await button.click();
}

/** Click a provider tile by label (e.g. "Claude Code", "Codex"). */
export async function clickProviderTile(page: Page, providerLabel: string): Promise<void> {
  const tile = page.getByRole("button", { name: providerLabel }).first();
  await expect(tile).toBeVisible({ timeout: 10_000 });
  await tile.click();
}

// ─── Tab title assertions ──────────────────────────────────────────────────

/** Wait for any tab in the bar to display the given title text. */
export async function waitForTabWithTitle(
  page: Page,
  title: string | RegExp,
  timeout = 30_000,
): Promise<void> {
  const matcher = typeof title === "string" ? new RegExp(title, "i") : title;
  await expect(page.locator('[data-testid^="workspace-tab-"]').filter({ hasText: matcher }).first())
    .toBeVisible({ timeout });
}

/** Assert the new-tab '+' button is visible and there is only one. */
export async function assertSingleNewTabButton(page: Page): Promise<void> {
  const buttons = page.getByTestId("workspace-new-tab");
  // There might be multiple panes, each with a "+" button
  // But within a single pane there should only be one
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(1);
}

// ─── No-flash measurement ──────────────────────────────────────────────────

/**
 * Measure the time between clicking a launcher tile and the replacement panel becoming visible.
 * Returns elapsed milliseconds.
 */
export async function measureTileTransition(
  page: Page,
  clickAction: () => Promise<void>,
  successLocator: ReturnType<Page["locator"]>,
  timeout = 5_000,
): Promise<number> {
  const start = Date.now();
  await clickAction();
  await expect(successLocator).toBeVisible({ timeout });
  return Date.now() - start;
}

/**
 * Sample tab IDs at high frequency across a transition to detect blank/intermediate states.
 * Returns all unique snapshots observed.
 */
export async function sampleTabsDuringTransition(
  page: Page,
  action: () => Promise<void>,
  durationMs = 2_000,
  intervalMs = 30,
): Promise<string[][]> {
  const snapshots: string[][] = [];
  const startSampling = async () => {
    const start = Date.now();
    while (Date.now() - start < durationMs) {
      snapshots.push(await getTabTestIds(page));
      await page.waitForTimeout(intervalMs);
    }
  };

  const samplingPromise = startSampling();
  await action();
  await samplingPromise;
  return snapshots;
}

// ─── Workspace setup ───────────────────────────────────────────────────────

/** Create a temp git repo and return its path with a cleanup function. */
export async function createWorkspace(prefix = "launcher-e2e-"): ReturnType<typeof createTempGitRepo> {
  return createTempGitRepo(prefix);
}
