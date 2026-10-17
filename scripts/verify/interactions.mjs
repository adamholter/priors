/**
 * Interaction regression checks against a running server.
 *   BASE=http://localhost:48740 node scripts/verify/interactions.mjs
 * Covers what unit tests cannot: that the builder's controls respond when a person uses them.
 * Each check is a bug that shipped once or could: a model checkbox that does nothing, an effort row that
 * does not filter, a default view that leaves nothing out, a point card that never appears.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:48740";
const browser = await chromium.launch();
const errors = [];
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };

try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });

  // Settings are opened from each chart's own summary; wait out hydration, since a click before it does nothing.
  const openSettings = async (label) => {
    const summary = page.locator(`summary[aria-label="${label}"]`).first();
    await summary.scrollIntoViewIfNeeded();
    for (let tries = 0; tries < 10; tries++) {
      await summary.click();
      if (await page.locator("details[open] [class*=modelCount]").first().isVisible().catch(() => false)) break;
      await page.waitForTimeout(500);
    }
    return page.locator("details[open]").first();
  };
  const selected = async (menu) => {
    const text = await menu.getByText(/\d+ of \d+ selected/).first().textContent();
    const [on, total] = text.match(/\d+/g).map(Number);
    return { on, total };
  };
  const close = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(200); };

  for (const label of ["Ranking settings", "Pareto settings", "Time per task settings"]) {
    await check(`${label}: a model checkbox deselects and reselects`, async () => {
      const menu = await openSettings(label);
      const start = await selected(menu);
      assert.ok(start.total > 10, "the picker lists models");
      const box = menu.locator("[class*=model] input[type=checkbox]").first();
      const was = await box.isChecked();
      await box.click();
      await page.waitForTimeout(300);
      assert.equal(await box.isChecked(), !was, "checkbox flipped");
      assert.equal((await selected(menu)).on, start.on + (was ? -1 : 1), "count follows the checkbox");
      await box.click();
      await page.waitForTimeout(300);
      assert.equal((await selected(menu)).on, start.on, "reselecting restores the count");
      await close();
    });
  }

  await check("None, All and the weights shortcuts change the whole list", async () => {
    const menu = await openSettings("Pareto settings");
    await menu.getByRole("button", { name: "None", exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal((await selected(menu)).on, 0, "None clears every model");
    await menu.getByRole("button", { name: "All", exact: true }).click();
    await page.waitForTimeout(300);
    const all = await selected(menu);
    assert.equal(all.on, all.total, "All selects every model");
    await close();
  });

  await check("a new index starts without superseded model versions", async () => {
    const fresh = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    await fresh.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
    await fresh.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
    const summary = fresh.locator('summary[aria-label="Ranking settings"]').first();
    for (let tries = 0; tries < 10; tries++) { await summary.click(); if (await fresh.locator("details[open] [class*=modelCount]").first().isVisible().catch(() => false)) break; await fresh.waitForTimeout(500); }
    const menu = fresh.locator("details[open]").first();
    const text = await menu.getByText(/\d+ of \d+ selected/).first().textContent();
    const [on, total] = text.match(/\d+/g).map(Number);
    assert.ok(on < total, `the default view hides some models (${on} of ${total})`);
    await menu.getByRole("button", { name: "All", exact: true }).click();
    await fresh.waitForTimeout(300);
    const all = await menu.getByText(/\d+ of \d+ selected/).first().textContent();
    assert.match(all, new RegExp(`${total} of ${total}`), "All shows every model, and stays that way");
    await fresh.context().close();
  });

  await check("the effort row filters the cost chart one effort at a time", async () => {
    const menu = await openSettings("Pareto settings");
    await menu.getByRole("tab", { name: "Settings" }).click();
    const row = menu.getByRole("group", { name: "Reasoning" });
    const buttons = row.getByRole("button");
    assert.deepEqual(await buttons.allTextContents(), ["none", "low", "medium", "high", "xhigh", "max"]);
    assert.equal(await row.getByRole("button", { name: "none", exact: true }).getAttribute("aria-pressed"), "false", "none is off by default");
    assert.equal(await row.getByRole("button", { name: "max", exact: true }).getAttribute("aria-pressed"), "true");
    await row.getByRole("button", { name: "max", exact: true }).click();
    assert.equal(await row.getByRole("button", { name: "max", exact: true }).getAttribute("aria-pressed"), "false", "max switches off");
    await row.getByRole("button", { name: "none", exact: true }).click();
    assert.equal(await row.getByRole("button", { name: "none", exact: true }).getAttribute("aria-pressed"), "true", "none switches on");
    await close();
    assert.match(page.url(), /eff=/, "the choice is in the link");
  });

  await check("hovering a mark opens its card with crosshair guides", async () => {
    const chart = page.locator('[role="img"][aria-label*="subscription cost"], [role="img"][aria-label*="cost per task"]').first();
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    const card = page.getByRole("status", { name: "Selected model" });
    let found = false;
    for (let y = box.y + 60; y < box.y + box.height - 60 && !found; y += 14) {
      for (let x = box.x + 80; x < box.x + box.width - 60 && !found; x += 14) {
        await page.mouse.move(x, y);
        found = await card.isVisible();
      }
    }
    assert.ok(found, "a card appears over some mark");
    const bbox = await card.boundingBox();
    assert.ok(bbox.x > box.x + box.width / 2 && bbox.y > box.y + box.height / 2, "the card sits in the lower right, not beside the mark");
  });

  assert.deepEqual(errors, [], "no page errors");
  console.log(`PASS interactions: ${checks.length} checks\n  ${checks.join("\n  ")}`);
} finally {
  await browser.close();
}
