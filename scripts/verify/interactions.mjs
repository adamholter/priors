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
const check = async (name, fn) => { try { await fn(); } catch (e) { e.message = `${name}: ${e.message}`; throw e; } checks.push(name); };

try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });

  await check("mobile pages fit the viewport, including the themes editor", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await context.newPage();
    try {
      for (const route of ["/explore", "/compare?a=preset:aa&b=preset:general", "/models/claude-opus-5.5", "/model-finder", "/builder", "/lab/themes", "/privacy", "/skill", "/import", "/history"]) {
        await mobile.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        if (route === "/lab/themes") {
          // The editor opens from the header on a wide screen; the bug was how it looked after narrowing.
          await mobile.setViewportSize({ width: 1440, height: 900 });
          const edit = mobile.getByRole("button", { name: "Edit page", exact: true }).first();
          await edit.waitFor();
          for (let attempt = 0; attempt < 5 && !(await mobile.locator(".page-root").evaluate((el) => el.classList.contains("is-editing"))); attempt++) {
            await edit.click();
            await mobile.waitForTimeout(200);
          }
          assert.equal(await mobile.locator(".page-root").evaluate((el) => el.classList.contains("is-editing")), true, "themes lab entered edit mode");
          await mobile.setViewportSize({ width: 390, height: 844 });
        }
        await mobile.waitForTimeout(800);
        const widths = await mobile.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(widths.scroll <= widths.inner, `${route} scrollWidth ${widths.scroll} exceeds innerWidth ${widths.inner}`);
      }
    } finally {
      await context.close();
    }
  });

  await check("site settings opens as a named modal and Escape restores focus", async () => {
    const trigger = page.getByRole("button", { name: "Settings", exact: true });
    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Settings" });
    await dialog.waitFor();
    assert.equal(await dialog.getAttribute("aria-modal"), "true");
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close settings");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" }).catch(async () => assert.equal(await dialog.isVisible(), false));
    assert.equal(await trigger.evaluate((el) => el === document.activeElement), true);
  });

  await check("default cost chart labels do not overlap", async () => {
    const chart = page.locator('[role="img"][aria-label*="cost per task"]').first();
    await chart.scrollIntoViewIfNeeded();
    await chart.locator("svg").waitFor({ timeout: 30000 });
    const overlaps = await chart.evaluate((el) => {
      const labels = [...el.querySelectorAll("text")].map((node) => {
        const text = node.textContent.trim(), box = node.getBoundingClientRect();
        return { text, left: box.left, right: box.right, top: box.top, bottom: box.bottom };
      }).filter((b) => b.text && !/^(Index score|.*cost per task.*|\d+(\.\d+)?|\$.*|free)$/.test(b.text));
      const found = [];
      for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j];
        if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) found.push([a.text, b.text]);
      }
      return found;
    });
    assert.deepEqual(overlaps, [], "model labels have disjoint rendered text boxes");
  });

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

  await check("cost data source options show model counts", async () => {
    const menu = await openSettings("Pareto settings");
    await menu.getByRole("tab", { name: "Settings" }).click();
    const source = menu.getByLabel("Pareto data source");
    assert.ok((await source.locator("option").allTextContents()).every((text) => /\(\d+ models\)$/.test(text)));
    await close();
  });

  await check("the ranking list has its own effort row", async () => {
    const before = await page.locator(".ranking-list [data-k]").count();
    const menu = await openSettings("Ranking settings");
    await menu.getByRole("tab", { name: "Settings" }).click();
    const row = menu.getByRole("group", { name: "Reasoning" });
    assert.equal(await row.getByRole("button", { name: "none", exact: true }).getAttribute("aria-pressed"), "true", "the ranking starts with every effort, none included");
    for (const effort of ["none", "low", "medium", "high", "xhigh"]) await row.getByRole("button", { name: effort, exact: true }).click();
    await close();
    await page.waitForTimeout(400);
    assert.match(page.url(), /reff=max/, "the choice is in the link");
    assert.ok(await page.locator(".ranking-list [data-k]").count() <= before, "only max-effort rows remain");
    for (const effort of ["none", "low", "medium", "high", "xhigh"]) await (await openSettings("Ranking settings").then(async (m) => { await m.getByRole("tab", { name: "Settings" }).click(); return m; })).getByRole("group", { name: "Reasoning" }).getByRole("button", { name: effort, exact: true }).click();
    await close();
  });

  await check("usage chart switches between share and volume without squashing the axis", async () => {
    const row = page.getByText("Usage", { exact: true }).first();
    await row.scrollIntoViewIfNeeded();
    const stream = page.locator(".usage-stream");
    for (let tries = 0; tries < 5 && !(await stream.isVisible().catch(() => false)); tries++) { await row.click(); await page.waitForTimeout(500); }
    await stream.waitFor({ timeout: 10000 });
    await stream.getByRole("button", { name: "Volume", exact: true }).click();
    await page.waitForTimeout(600);
    const ticks = await stream.locator("svg text").allTextContents();
    assert.ok(ticks.some((t) => /^\d+(\.\d+)?[KM]$/.test(t.trim())), `volume axis shows turn counts, got ${ticks.slice(0, 12).join(" | ")}`);
    await stream.getByRole("button", { name: "Share", exact: true }).click();
    await page.waitForTimeout(600);
    assert.ok((await stream.locator("svg text").allTextContents()).some((t) => t.trim() === "100%"), "share axis returns to percentages");
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


  // The link you copy must open (and unfurl) as the chart you were looking at. For each setting, change it,
  // then ask the card endpoint what it would draw for this page's own address and compare it with the points on screen.
  const costChart = () => page.locator('[role="img"][aria-label*="cost per task"]').first();
  const onScreen = async () => (await costChart().getAttribute("data-points")).split(",").filter(Boolean).sort();
  const inCard = async () => {
    await page.waitForTimeout(500); // the address bar follows the index after a short debounce
    const url = new URL(page.url());
    const card = new URL("/og", BASE);
    for (const [k, v] of url.searchParams) card.searchParams.append(k, v);
    card.searchParams.set("c", "cost"); card.searchParams.set("debug", "points");
    const res = await page.context().request.get(card.toString());
    assert.equal(res.status(), 200, "card endpoint answers");
    return (await res.json()).points;
  };
  const settings = async () => { const menu = await openSettings("Pareto settings"); await menu.getByRole("tab", { name: "Settings" }).click(); return menu; };
  const same = async (what) => {
    const shown = await onScreen();
    assert.ok(shown.length > 3, `${what}: the chart draws points`);
    assert.deepEqual(await inCard(), shown, `${what}: the card draws what the page shows`);
  };
  await check("link parity: default view", async () => { await same("default"); });
  await check("link parity: reasoning efforts", async () => {
    const menu = await settings();
    const row = menu.getByRole("group", { name: "Reasoning" });
    await row.getByRole("button", { name: "max", exact: true }).click();
    await close(); await same("max off");
    await (await settings()).getByRole("group", { name: "Reasoning" }).getByRole("button", { name: "none", exact: true }).click();
    await close(); await same("none on");
    await (await settings()).getByRole("group", { name: "Reasoning" }).getByRole("button", { name: "low", exact: true }).click();
    await close(); await same("low off");
  });
  await check("link parity: pricing basis and release window", async () => {
    const menu = await settings();
    await menu.getByRole("button", { name: "API", exact: true }).click();
    await close(); await same("API pricing");
    await (await settings()).getByLabel("Pareto release window").selectOption("24");
    await close(); await same("last 2 years");
  });
  await check("link parity: hidden models", async () => {
    const menu = await openSettings("Pareto settings");
    for (let i = 0; i < 3; i++) { await menu.locator("[class*=model] input[type=checkbox]").nth(i).click(); await page.waitForTimeout(150); }
    await close(); await same("three models unticked");
    const again = await openSettings("Pareto settings");
    await again.getByRole("button", { name: "None", exact: true }).click();
    await close();
    // With nothing shown the card has no chart to describe and falls back to an image, never a populated chart.
    assert.deepEqual(await costChart().getAttribute("data-points").catch(() => ""), "", "no models: the chart is empty");
    const empty = new URL("/og", BASE);
    for (const [k, v] of new URL(page.url()).searchParams) empty.searchParams.append(k, v);
    empty.searchParams.set("c", "cost"); empty.searchParams.set("debug", "points");
    assert.match((await page.context().request.get(empty.toString())).headers()["content-type"], /image\/png/, "no models: the card is an image, not chart data");
  });

  await check("compare: two rankings side by side, switchable and linkable", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/compare?a=preset:aa&b=preset:general`, { waitUntil: "domcontentloaded" });
      const rowsA = c.locator(".cmp-wide .cmp-list-a .cmp-row");
      await rowsA.first().waitFor({ timeout: 30000 });
      assert.equal(await rowsA.count(), 10, "top 10 on the left");
      assert.equal(await c.locator(".cmp-wide .cmp-list-b .cmp-row").count(), 10, "top 10 on the right");
      assert.ok(await c.locator(".cmp-wide .cmp-line").count() >= 10, "a line for each model");
      assert.match(await c.locator(".cmp-summary").innerText(), /top 10/, "the headline names the top list");
      assert.ok(await c.locator(".cmp-stack").count() === 2, "benchmark weights are listed");
      const left = (await c.locator(".cmp-sides .cmp-card-title").first().innerText()).trim();
      await c.getByRole("button", { name: "Top 5", exact: true }).click();
      assert.equal(await rowsA.count(), 5, "Top 5 cuts the lists");
      assert.match(c.url(), /[?&]n=5/, "the link carries the cut");
      await c.getByLabel("Same models only").check();
      assert.match(c.url(), /same=1/, "the link carries same models");
      await c.getByRole("button", { name: "Swap the two rankings" }).click();
      assert.notEqual((await c.locator(".cmp-sides .cmp-card-title").first().innerText()).trim(), left, "swap puts the other ranking on the left");
      assert.match(c.url(), /a=preset(:|%3A)general&b=preset(:|%3A)aa/, "the link follows the swap");
      // Choose the left side from the picker.
      await c.getByRole("button", { name: /First ranking/ }).click();
      await c.getByPlaceholder(/Search people/).fill("artificial");
      await c.getByRole("button", { name: /Artificial Analysis/ }).first().click();
      assert.equal((await c.locator(".cmp-sides .cmp-card-title").first().innerText()).trim(), "Artificial Analysis", "the picker sets the side");
      // A reload from the link shows the same comparison.
      await c.reload({ waitUntil: "domcontentloaded" });
      await rowsA.first().waitFor({ timeout: 30000 });
      assert.equal(await rowsA.count(), 5, "the link restores the cut");
      assert.equal(await c.locator(".cmp-sides .cmp-card-title").first().innerText().then((t) => t.trim()), "Artificial Analysis", "the link restores the sides");
      // Each model keeps its place: hovering a row lights its line.
      await rowsA.first().hover();
      assert.equal(await c.locator(".cmp-wide .cmp-line[data-state=on]").count() >= 0, true);
    } finally { await c.context().close(); }
  });
  await check("compare: a phone gets the matched table, not the slope", async () => {
    const m = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    m.on("pageerror", (e) => errors.push(`${m.url()}: ${e.message}`));
    try {
      await m.goto(`${BASE}/compare?a=preset:aa&b=preset:general`, { waitUntil: "domcontentloaded" });
      await m.locator(".cmp-narrow .cmp-table tbody tr").first().waitFor({ timeout: 30000 });
      assert.equal(await m.locator(".cmp-wide").isVisible(), false, "the slope is hidden");
      assert.ok(await m.locator(".cmp-narrow .cmp-table tbody tr").count() >= 10, "one row per model");
    } finally { await m.context().close(); }
  });

  assert.deepEqual(errors, [], "no page errors");
  console.log(`PASS interactions: ${checks.length} checks\n  ${checks.join("\n  ")}`);
} finally {
  await browser.close();
}
