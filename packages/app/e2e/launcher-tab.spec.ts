import { test, expect } from "./fixtures";
import { createTempGitRepo } from "./helpers/workspace";
import {
  gotoWorkspace,
  waitForLauncherPanel,
  assertProviderTilesVisible,
  assertNewChatTileVisible,
  assertTerminalTileVisible,
  assertSingleNewTabButton,
  clickNewTabButton,
  pressNewTabShortcut,
  clickNewChat,
  clickTerminal,
  clickProviderTile,
  countTabsOfKind,
  getTabTestIds,
  waitForTabWithTitle,
  measureTileTransition,
  sampleTabsDuringTransition,
} from "./helpers/launcher";
import {
  connectTerminalClient,
  waitForTerminalContent,
  setupDeterministicPrompt,
  type TerminalPerfDaemonClient,
} from "./helpers/terminal-perf";

// ─── Shared state ──────────────────────────────────────────────────────────

let tempRepo: { path: string; cleanup: () => Promise<void> };

test.beforeAll(async () => {
  tempRepo = await createTempGitRepo("launcher-e2e-");
});

test.afterAll(async () => {
  if (tempRepo) await tempRepo.cleanup();
});

// ═══════════════════════════════════════════════════════════════════════════
// Launcher Tab Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Launcher tab", () => {
  test("Cmd+T opens launcher panel with New Chat, Terminal, and provider tiles", async ({
    page,
  }) => {
    await gotoWorkspace(page, tempRepo.path);

    await pressNewTabShortcut(page);

    await waitForLauncherPanel(page);
    await assertNewChatTileVisible(page);
    await assertTerminalTileVisible(page);
    await assertProviderTilesVisible(page);
  });

  test("opening two new tabs creates two launcher tabs", async ({ page }) => {
    await gotoWorkspace(page, tempRepo.path);

    await pressNewTabShortcut(page);
    await waitForLauncherPanel(page);
    const countAfterFirst = await countTabsOfKind(page, "launcher");

    await pressNewTabShortcut(page);
    await waitForLauncherPanel(page);
    const countAfterSecond = await countTabsOfKind(page, "launcher");

    expect(countAfterSecond).toBe(countAfterFirst + 1);
  });

  test("clicking New Chat replaces launcher in-place with draft tab", async ({ page }) => {
    await gotoWorkspace(page, tempRepo.path);

    await clickNewTabButton(page);
    await waitForLauncherPanel(page);

    const tabsBefore = await getTabTestIds(page);
    const launcherCountBefore = tabsBefore.filter((id) => id.includes("launcher")).length;

    await clickNewChat(page);

    // Draft composer should appear (the agent message input)
    const composer = page.getByRole("textbox", { name: "Message agent..." });
    await expect(composer.first()).toBeVisible({ timeout: 15_000 });

    // Launcher tab should have been replaced (not added alongside)
    const tabsAfter = await getTabTestIds(page);
    const launcherCountAfter = tabsAfter.filter((id) => id.includes("launcher")).length;
    const draftCountAfter = tabsAfter.filter((id) => id.includes("draft")).length;

    expect(launcherCountAfter).toBe(launcherCountBefore - 1);
    expect(draftCountAfter).toBeGreaterThanOrEqual(1);
    // Total tab count should stay the same (replaced, not added)
    expect(tabsAfter.length).toBe(tabsBefore.length);
  });

  test("clicking Terminal replaces launcher with standalone terminal", async ({ page }) => {
    test.setTimeout(45_000);
    await gotoWorkspace(page, tempRepo.path);

    await clickNewTabButton(page);
    await waitForLauncherPanel(page);

    const tabsBefore = await getTabTestIds(page);

    await clickTerminal(page);

    // Terminal surface should appear
    const terminal = page.locator('[data-testid="terminal-surface"]');
    await expect(terminal.first()).toBeVisible({ timeout: 20_000 });

    // Tab count stays the same (in-place replacement)
    const tabsAfter = await getTabTestIds(page);
    expect(tabsAfter.length).toBe(tabsBefore.length);

    // The launcher tab is gone, a terminal tab exists
    const terminalTabs = tabsAfter.filter((id) => id.includes("terminal"));
    expect(terminalTabs.length).toBeGreaterThanOrEqual(1);
  });

  test("clicking a provider tile replaces launcher with terminal agent tab", async ({ page }) => {
    test.setTimeout(45_000);
    await gotoWorkspace(page, tempRepo.path);

    await clickNewTabButton(page);
    await waitForLauncherPanel(page);

    const tabsBefore = await getTabTestIds(page);

    // Click the first visible provider tile under "Terminal Agents"
    const providerTiles = page.locator('[role="button"]').filter({
      has: page.locator("text=Terminal Agents").locator("..").locator(".."),
    });

    // Try clicking any provider tile — find the first one after the "Terminal Agents" label
    const terminalAgentsLabel = page.getByText("Terminal Agents", { exact: true }).first();
    await expect(terminalAgentsLabel).toBeVisible({ timeout: 10_000 });

    // The provider grid follows the label. Click the first provider tile.
    const providerGrid = terminalAgentsLabel.locator("~ *").first();
    const firstProvider = providerGrid.getByRole("button").first();
    if (await firstProvider.isVisible().catch(() => false)) {
      await firstProvider.click();
    } else {
      // Fallback: look for any provider button after the section label
      const allButtons = page.getByRole("button");
      const count = await allButtons.count();
      let clicked = false;
      for (let i = 0; i < count; i++) {
        const btn = allButtons.nth(i);
        const text = await btn.innerText().catch(() => "");
        // Skip known non-provider buttons
        if (["New Chat", "Terminal", "More", "+"].includes(text.trim())) continue;
        if (!text.trim()) continue;
        await btn.click();
        clicked = true;
        break;
      }
      if (!clicked) {
        test.skip(true, "No provider tiles available");
        return;
      }
    }

    // Should see an agent panel (terminal surface or agent stream)
    const agentOrTerminal = page.locator(
      '[data-testid="terminal-surface"], [data-testid^="agent-"]',
    );
    await expect(agentOrTerminal.first()).toBeVisible({ timeout: 30_000 });

    // Tab count stays the same (replaced, not added)
    const tabsAfter = await getTabTestIds(page);
    expect(tabsAfter.length).toBe(tabsBefore.length);
  });

  test("tab bar shows a single + button per pane", async ({ page }) => {
    await gotoWorkspace(page, tempRepo.path);
    await assertSingleNewTabButton(page);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Terminal Title Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Terminal title propagation", () => {
  let client: TerminalPerfDaemonClient;

  test.beforeAll(async () => {
    client = await connectTerminalClient();
  });

  test.afterAll(async () => {
    if (client) await client.close();
  });

  test("terminal tab title updates from OSC title escape sequence", async ({ page }) => {
    test.setTimeout(60_000);

    const result = await client.createTerminal(tempRepo.path, "title-test");
    if (!result.terminal) throw new Error(`Failed to create terminal: ${result.error}`);
    const terminalId = result.terminal.id;

    try {
      // Navigate to workspace and open the terminal
      await gotoWorkspace(page, tempRepo.path);
      await clickNewTabButton(page);
      await waitForLauncherPanel(page);
      await clickTerminal(page);

      const terminal = page.locator('[data-testid="terminal-surface"]');
      await expect(terminal.first()).toBeVisible({ timeout: 20_000 });
      await terminal.first().click();

      await setupDeterministicPrompt(page);

      // Send OSC 0 (set window title) escape sequence
      const testTitle = `E2E-Title-${Date.now()}`;
      await terminal
        .first()
        .pressSequentially(`printf '\\033]0;${testTitle}\\007'\n`, { delay: 0 });

      // Wait for the tab to reflect the new title
      await waitForTabWithTitle(page, testTitle, 15_000);
    } finally {
      await client.killTerminal(terminalId).catch(() => {});
    }
  });

  test("title debouncing coalesces rapid changes", async ({ page }) => {
    test.setTimeout(60_000);

    const result = await client.createTerminal(tempRepo.path, "debounce-test");
    if (!result.terminal) throw new Error(`Failed to create terminal: ${result.error}`);
    const terminalId = result.terminal.id;

    try {
      await gotoWorkspace(page, tempRepo.path);
      await clickNewTabButton(page);
      await waitForLauncherPanel(page);
      await clickTerminal(page);

      const terminal = page.locator('[data-testid="terminal-surface"]');
      await expect(terminal.first()).toBeVisible({ timeout: 20_000 });
      await terminal.first().click();

      await setupDeterministicPrompt(page);

      // Fire many rapid title changes — only the last should stick
      const finalTitle = `Final-${Date.now()}`;
      for (let i = 0; i < 5; i++) {
        await terminal
          .first()
          .pressSequentially(`printf '\\033]0;Rapid-${i}\\007'\n`, { delay: 0 });
      }
      await terminal
        .first()
        .pressSequentially(`printf '\\033]0;${finalTitle}\\007'\n`, { delay: 0 });

      // The tab should eventually settle on the final title
      await waitForTabWithTitle(page, finalTitle, 15_000);
    } finally {
      await client.killTerminal(terminalId).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// No-Flash Transition Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe("Launcher transitions (no flash)", () => {
  test("New Chat transition has no blank intermediate tab state", async ({ page }) => {
    await gotoWorkspace(page, tempRepo.path);

    await clickNewTabButton(page);
    await waitForLauncherPanel(page);

    // Sample tabs at high frequency across the transition
    const snapshots = await sampleTabsDuringTransition(
      page,
      () => clickNewChat(page),
      2_000,
      30,
    );

    // Every snapshot should have at least one tab — no blank/zero-tab frames
    for (const snapshot of snapshots) {
      expect(snapshot.length).toBeGreaterThanOrEqual(1);
    }

    // Tab count should never increase (no duplicate flash from add-then-remove)
    const counts = snapshots.map((s) => s.length);
    const maxCount = Math.max(...counts);
    const initialCount = counts[0] ?? 0;

    // Allow at most +1 transient tab (tolerance for React render batching)
    expect(maxCount).toBeLessThanOrEqual(initialCount + 1);
  });

  test("Terminal transition completes within visual budget", async ({ page }) => {
    test.setTimeout(30_000);
    await gotoWorkspace(page, tempRepo.path);

    await clickNewTabButton(page);
    await waitForLauncherPanel(page);

    const terminal = page.locator('[data-testid="terminal-surface"]');
    const elapsed = await measureTileTransition(
      page,
      () => clickTerminal(page),
      terminal.first(),
      20_000,
    );

    // Terminal surface should appear within a reasonable budget.
    // Note: terminal creation involves a server round-trip, so we allow more time
    // than a pure in-memory transition, but it should still be well under 5 seconds.
    expect(elapsed).toBeLessThan(5_000);
  });

  test("New Chat click → composer appears without launcher flash", async ({ page }) => {
    await gotoWorkspace(page, tempRepo.path);

    await clickNewTabButton(page);
    await waitForLauncherPanel(page);

    const composer = page.getByRole("textbox", { name: "Message agent..." }).first();

    const elapsed = await measureTileTransition(
      page,
      () => clickNewChat(page),
      composer,
      10_000,
    );

    // Draft replacement is fully in-memory — should be fast
    // We use a generous budget here because CI can be slow, but the key assertion
    // is that no blank/flash frame appears (tested above).
    expect(elapsed).toBeLessThan(3_000);
  });
});
