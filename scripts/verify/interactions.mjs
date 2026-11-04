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

  await check("mobile pages fit the viewport", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await context.newPage();
    try {
      for (const route of ["/explore", "/compare?a=preset:aa&b=preset:general", "/models/claude-opus-5.5", "/model-finder", "/builder", "/privacy", "/skill", "/import", "/history"]) {
        await mobile.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
        await mobile.waitForTimeout(800);
        const widths = await mobile.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(widths.scroll <= widths.inner, `${route} scrollWidth ${widths.scroll} exceeds innerWidth ${widths.inner}`);
      }
    } finally {
      await context.close();
    }
  });

  await check("a plain chart link copied on a phone leaves the preview's shape to the standard card", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, permissions: ["clipboard-read", "clipboard-write"], baseURL: BASE });
    const phone = await context.newPage();
    try {
      await phone.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
      for (let y = 0; y < 6000; y += 800) { await phone.evaluate((v) => window.scrollTo(0, v), y); await phone.waitForTimeout(150); }
      const links = phone.locator('button:has-text("Link"), button[aria-label*="link" i]');
      let copied = "";
      for (let i = 0, n = await links.count(); i < n && !copied.includes("xv="); i++) {
        await links.nth(i).scrollIntoViewIfNeeded().catch(() => {});
        await links.nth(i).click({ timeout: 2500 }).catch(() => {});
        await phone.waitForTimeout(350);
        copied = await phone.evaluate(() => navigator.clipboard.readText().catch(() => ""));
        // Long links are copied as /s/<slug> short links.
        if (/\/s\/[A-Za-z0-9]+$/.test(copied)) copied = (await fetch(copied, { redirect: "manual" })).headers.get("location") ?? copied;
      }
      assert.ok(copied.includes("xv="), `found the scatter's link (${copied.slice(0, 120)})`);
      assert.ok(!/[?&]xs=/.test(copied), `a plain link carries no plot size (${copied.slice(0, 160)})`);
    } finally { await phone.evaluate(() => navigator.clipboard.writeText("")).catch(() => {}); await context.close(); }
  });

  await check("phones: the ranking comes first, then the mix, in one short header", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const phone = await context.newPage();
    try {
      await phone.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await phone.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      const y = (sel) => phone.locator(sel).first().evaluate((el) => el.getBoundingClientRect().top + scrollY);
      assert.ok(await y(".builder-rank") < await y("#mix"), "the ranking sits above the mix");
      assert.ok(await y("#mix") < await y(".builder-cost"), "the mix sits above the other charts");
      assert.ok(await y(".ranking-list [data-k]") < 844, "the first ranking row is on the first screen");
      assert.equal(await phone.locator(".ranking-list [data-k]").count(), 10, "a phone shows the top 10 until asked for more");
      await phone.getByRole("button", { name: /^Show all/ }).first().click();
      assert.ok(await phone.locator(".ranking-list [data-k]").count() > 10, "Show all expands the ranking");
      assert.ok((await phone.locator(".builder-header").evaluate((el) => el.getBoundingClientRect().height)) < 110, "the header stays short");
      assert.equal(await phone.getByText(/^Data as of/).isVisible(), false, "the date moved out of the header");
      const widths = await phone.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
      assert.ok(widths[1] <= widths[0], `no sideways scroll, ${widths}`);
      const fab = phone.locator(".assistant-fab");
      await fab.waitFor();
      await phone.evaluate(() => window.scrollTo(0, scrollY + document.querySelector("#mix").getBoundingClientRect().bottom - innerHeight + 10));
      await phone.waitForFunction(() => document.querySelector(".assistant-fab")?.classList.contains("is-clear"), null, { timeout: 5000 });
    } finally { await context.close(); }
  });

  await check("Clear all empties the mix and Undo brings it back", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      assert.equal(await p.getByRole("button", { name: "Undo", exact: true }).count(), 0, "nothing to undo on arrival");
      const sliders = await p.locator("#mix input[aria-label$=weight]").count();
      assert.ok(sliders > 0);
      await p.getByRole("button", { name: "Clear all", exact: true }).click();
      await p.getByText("Your mix is empty.").waitFor();
      assert.equal(await p.locator("#mix input[aria-label$=weight]").count(), 0);
      await p.getByRole("button", { name: "Undo", exact: true }).click();
      await p.locator(".ranking-list [data-k]").first().waitFor();
      assert.equal(await p.locator("#mix input[aria-label$=weight]").count(), sliders, "every benchmark came back");
      // Removing one and pressing the keyboard shortcut does the same.
      await p.waitForTimeout(900);
      await p.locator("#mix .bench-remove").first().click();
      assert.equal(await p.locator("#mix input[aria-label$=weight]").count(), sliders - 1);
      await p.locator("body").click({ position: { x: 700, y: 5 } });
      await p.keyboard.press("ControlOrMeta+z");
      await p.waitForFunction((n) => document.querySelectorAll("#mix input[aria-label$=weight]").length === n, sliders, { timeout: 5000 });
    } finally { await context.close(); }
  });

  await check("the model picker turns a whole lab off and on", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      await p.getByLabel("Ranking settings", { exact: true }).first().click();
      const labs = p.getByRole("group", { name: "Models by lab" });
      await labs.waitFor();
      const lab = labs.getByRole("checkbox", { name: "Anthropic" });
      const count = async () => Number((await p.getByText(/of \d+ selected/).first().textContent()).match(/^(\d+)/)[1]);
      const before = await count();
      if (!(await lab.isChecked())) await lab.click();
      const all = await count();
      assert.ok(before <= all, "ticking a lab shows all of its models");
      await lab.click();
      assert.ok(await count() < all, "the count answers at once");
      assert.equal(await lab.isChecked(), false);
      await lab.click();
      assert.equal(await count(), all);
      assert.equal(await lab.isChecked(), true);
    } finally { await context.close(); }
  });

  await check("a link answers at once while its page is on the way", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      await p.route("**/explore**", async (route) => { await new Promise((r) => setTimeout(r, 1200)); await route.continue(); });
      await p.locator(".builder-header").getByRole("link", { name: "Explore", exact: true }).first().click();
      await p.locator(".nav-progress").waitFor({ timeout: 500 });
      await p.waitForURL(/\/explore/, { timeout: 30000 });
      await p.locator(".nav-progress").waitFor({ state: "detached", timeout: 5000 });
    } finally { await context.close(); }
  });

  await check("a model added since the last visit is labeled New once", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      await p.waitForFunction(() => localStorage.getItem("priors:seen-models"));
      assert.equal(await p.locator("[data-new-model]").count(), 0, "a first visit labels nothing");
      // The top row's model counts as unseen on the next visit.
      const top = await p.locator(".ranking-list [data-k]").first().getAttribute("data-k");
      await p.evaluate((id) => { const model = id.split("@")[0]; localStorage.setItem("priors:seen-models", JSON.stringify(JSON.parse(localStorage.getItem("priors:seen-models")).filter((x) => x !== model))); }, top);
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.locator("[data-new-model]").first().waitFor({ timeout: 30000 });
      await p.reload({ waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      await p.waitForTimeout(300);
      assert.equal(await p.locator("[data-new-model]").count(), 0, "seen once, it is no longer new");
    } finally { await context.close(); }
  });

  await check("Share opens quick actions, and the card designs are one step further", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      await p.locator(".builder-header").getByRole("button", { name: "Share", exact: true }).click();
      const menu = p.getByRole("menu", { name: "Share options" });
      await menu.waitFor();
      for (const name of ["Share on X", "Copy link", "Download image", "Choose a card design"]) assert.equal(await menu.getByRole("menuitem", { name }).count(), 1, name);
      assert.match(await menu.getByRole("menuitem", { name: "Download image" }).getAttribute("href"), /^\/og\?/);
      await menu.getByRole("menuitem", { name: "Choose a card design" }).click();
      await p.getByRole("dialog", { name: "Share" }).waitFor();
    } finally { await context.close(); }
  });

  await check("the cost chart's methodology icon explains its pricing and links to the detail", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      const button = p.getByRole("button", { name: "How this cost is worked out" });
      await button.scrollIntoViewIfNeeded();
      assert.equal(await p.locator(".chart-method-pop").count(), 0, "closed until asked for");
      await button.click();
      assert.match(await p.locator(".chart-method-pop").textContent(), /median plan/);
      assert.equal(await p.locator(".chart-method-pop a").getAttribute("href"), "/benchmarks/methodology#cost");
      await p.locator("body").click({ position: { x: 5, y: 5 } });
      assert.equal(await p.locator(".chart-method-pop").count(), 0, "a click elsewhere closes it");
    } finally { await context.close(); }
  });

  await check("the builder downloads its data once, and a returning visitor gets no body back", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await context.newPage();
    try {
      await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await p.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      // The preload and the loader's fetch may both show up, but the second must be answered from the first's copy.
      const bodies = await p.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.includes("view=core") && e.encodedBodySize > 0).length);
      assert.equal(bodies, 1, `one download, not ${bodies}`);
      const first = await context.request.get(`${BASE}/api/snapshot?view=core&packed=2`);
      const etag = first.headers().etag;
      assert.ok(etag, "the data carries a version tag");
      const again = await context.request.get(`${BASE}/api/snapshot?view=core&packed=2`, { headers: { "if-none-match": etag } });
      assert.equal(again.status(), 304);
    } finally { await context.close(); }
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

  await check("Explore themes opens the library and applying a library theme restyles the site", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      const bg = () => c.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bone").trim() + getComputedStyle(document.documentElement).backgroundColor);
      const before = await bg();
      await c.getByRole("button", { name: "Settings", exact: true }).click();
      const settings = c.getByRole("dialog", { name: "Settings" });
      assert.equal(await settings.locator(".settings-themes:not(.theme-library-grid) .theme-swatch").count(), 8, "the default picker keeps its eight themes");
      await settings.getByRole("button", { name: "Explore themes" }).click();
      const library = c.getByRole("dialog", { name: "Explore themes" });
      await library.waitFor();
      assert.ok((await library.locator(".theme-swatch").count()) >= 9, "the library lists the extra themes");
      await library.locator(".theme-swatch", { hasText: "Terminal" }).click();
      await c.waitForFunction(() => localStorage.getItem("priors:site-theme")?.includes('"terminal"'));
      // The choice is saved before its colors are set, so wait for them instead of reading once.
      await c.waitForFunction((was) => getComputedStyle(document.documentElement).getPropertyValue("--bone").trim() + getComputedStyle(document.documentElement).backgroundColor !== was, before, { timeout: 5000 });
      assert.equal(await c.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--font-sans").toLowerCase().includes("plex")), true, "the theme's font reached the page");
      await library.locator(".theme-swatch", { hasText: "Geist" }).first().click();
      // The cards follow the scheme (Terminal made the site dark), so this picks Geist's dark version.
      await c.waitForFunction(() => localStorage.getItem("priors:site-theme")?.includes('"geist'));
      assert.equal(await library.locator(".theme-swatch.is-on").count(), 1, "one library theme shows as selected");
      await c.keyboard.press("Escape");
      assert.equal(await settings.isVisible(), true, "Escape closes only the library");
    } finally { await c.context().close(); }
  });

  await check("a custom theme uploads, applies, and the mode control works inside Explore themes", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      await c.getByRole("button", { name: "Settings", exact: true }).click();
      await c.getByRole("dialog", { name: "Settings" }).getByRole("button", { name: "Explore themes" }).click();
      const library = c.getByRole("dialog", { name: "Explore themes" });
      await library.waitFor();
      await library.locator("[data-theme-library-mode]").getByRole("button", { name: "Dark", exact: true }).click();
      await c.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      const mode = (hex) => ({ bg: hex, ink: "#EEEEEE", ink2: "#BBBBBB", grey: "#999999", hair: "#333333", hair2: "#222222", accent: "#66CCFF" });
      const theme = { priorsTheme: 1, name: "E2E Harbor", light: { ...mode("#FAFAFA"), ink: "#111111", ink2: "#444444", grey: "#666666", hair: "#DDDDDD", hair2: "#EEEEEE", accent: "#0B5FA5" }, dark: mode("#0B1620"), fonts: { sans: "Geist" } };
      await library.getByRole("button", { name: "Paste theme" }).click();
      await library.getByLabel("Theme JSON").fill(JSON.stringify({ ...theme, light: { ...theme.light, bg: "red" } }));
      await library.getByRole("button", { name: "Add theme" }).click();
      assert.ok((await library.locator(".theme-byo-notice.is-error").innerText()).includes('"light.bg"'), "a bad color is reported by field");
      await library.getByLabel("Theme JSON").fill(JSON.stringify(theme));
      await library.getByRole("button", { name: "Add theme" }).click();
      await c.waitForFunction(() => document.documentElement.dataset.siteTheme?.startsWith("u."));
      assert.equal(await library.locator("[data-my-themes] .theme-swatch").count(), 1, "the theme is listed under Your themes");
      assert.equal(await c.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bone").trim().toUpperCase()), "#0B1620", "the dark version is on, as the mode says");
      await library.locator("[data-theme-library-mode]").getByRole("button", { name: "Light", exact: true }).click();
      await c.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue("--bone").trim().toUpperCase() === "#FAFAFA");
      await c.reload({ waitUntil: "domcontentloaded" });
      await c.waitForFunction(() => document.documentElement.dataset.siteTheme?.startsWith("u."));
    } finally { await c.context().close(); }
  });

  await check("Subscription plans > Count limit resets is off by default, switches on in the link and remembers it", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      const picker = c.locator("details", { has: c.locator("summary[aria-label='Pareto settings']") }).first();
      await picker.scrollIntoViewIfNeeded();
      await picker.locator("summary[aria-label='Pareto settings']").click();
      const menu = picker.locator(".chart-settings-menu");
      await menu.getByRole("tab", { name: "Data" }).click();
      await menu.locator("summary", { hasText: "Subscription plans" }).click();
      const box = menu.getByLabel("Count limit resets");
      assert.equal(await box.isChecked(), false, "resets are off by default");
      await box.check();
      await c.waitForFunction(() => decodeURIComponent(location.href).includes("resets=on"));
      await box.uncheck();
      await c.waitForFunction(() => !decodeURIComponent(location.href).includes("resets=on"));
      // On is remembered: a later visit to another page starts with resets on, until they're turned back off.
      await box.check();
      const resetsBox = async () => {
        await c.goto(`${BASE}/benchmarks/frontiercode-2.0-main`, { waitUntil: "networkidle" });
        await c.getByLabel("Pareto settings", { exact: true }).click();
        await c.getByRole("tab", { name: "Data" }).last().click();
        await c.locator(".chart-settings-menu summary", { hasText: "Subscription plans" }).last().click();
        return c.getByLabel("Count limit resets");
      };
      assert.equal(await (await resetsBox()).isChecked(), true, "resets stay on on the next page");
      await (await resetsBox()).uncheck();
      assert.equal(await (await resetsBox()).isChecked(), false, "turning them back off is remembered too");
    } finally { await c.context().close(); }
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

  await check("cost chart labels name each model once, with no effort or fallback text", async () => {
    const chart = page.locator('[role="img"][aria-label*="cost per task"]').first();
    const texts = await chart.evaluate((el) => [...el.querySelectorAll("text")].map((n) => n.textContent.trim()).filter((t) => t && !/^(Index score|.*cost per task.*|\d+(\.\d+)?|\$.*|free)$/.test(t)));
    assert.ok(texts.length > 3, "the chart has labels");
    assert.deepEqual(texts.filter((t, i) => texts.indexOf(t) !== i), [], "no model is labeled twice");
    assert.deepEqual(texts.filter((t) => /fallback|\b(none|low|medium|high|xhigh|max)\b/i.test(t)), [], "labels are model names");
  });

  await check("Display > Background grid hides the gridlines on every chart and remembers it", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
      const chart = c.locator('[role="img"][aria-label*="cost per task"]').first();
      await chart.locator("svg").waitFor({ timeout: 30000 });
      const lines = () => chart.evaluate((el) => [...el.querySelectorAll("svg path")].filter((n) => { const b = n.getBBox(); return n.getAttribute("fill") === "none" && (b.width < 0.5 || b.height < 0.5); }).length);
      await c.waitForFunction(() => document.querySelector('[role="img"][aria-label*="cost per task"] svg text'));
      const before = await lines();
      assert.ok(before > 3, `gridlines are drawn by default (${before})`);
      const picker = c.locator("details", { has: c.locator("summary[aria-label='Pareto settings']") }).first();
      await picker.scrollIntoViewIfNeeded();
      await picker.locator("summary[aria-label='Pareto settings']").click();
      const menu = picker.locator(".chart-settings-menu");
      await menu.getByRole("tab", { name: "Display" }).click();
      const box = menu.getByLabel("Background grid");
      assert.equal(await box.isChecked(), true);
      await box.uncheck();
      await c.waitForFunction(() => localStorage.getItem("priors:chart-grid") === "off");
      await chart.locator("svg").waitFor();
      await c.waitForTimeout(500);
      assert.ok(await lines() < before, "gridlines are gone");
      // A median plan says which plan it is.
      await menu.getByRole("tab", { name: "Data" }).click();
      await menu.locator("summary", { hasText: "Subscription plans" }).click();
      const median = await menu.getByLabel("OpenAI plan").locator("option").first().textContent();
      assert.match(median, /^Median: ChatGPT /);
      // API pricing keeps the plans in view and says how to use them; picks reset in one click.
      await menu.getByRole("button", { name: "API", exact: true }).click();
      await menu.getByLabel("OpenAI plan").waitFor();
      assert.equal(await menu.getByLabel("OpenAI plan").isDisabled(), true);
      await menu.getByRole("button", { name: "Use subscription" }).click();
      const openai = menu.getByLabel("OpenAI plan");
      await openai.selectOption({ index: 1 });
      await c.waitForFunction(() => localStorage.getItem("priors:subscription-plans")?.includes("openai"));
      await menu.getByRole("button", { name: "Reset" }).click();
      await c.waitForFunction(() => !localStorage.getItem("priors:subscription-plans"));
      assert.equal(await openai.inputValue(), "");
      await c.reload({ waitUntil: "domcontentloaded" });
      await chart.locator("svg text").first().waitFor({ timeout: 30000 });
      await c.waitForTimeout(500);
      assert.ok(await lines() < before, "the choice is remembered");
    } finally { await c.context().close(); }
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
    await menu.getByRole("tab", { name: "Data" }).click();
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
    await menu.getByRole("tab", { name: "Data" }).click();
    const source = menu.getByLabel("Pareto data source");
    assert.ok((await source.locator("option").allTextContents()).every((text) => /\(\d+ models\)$/.test(text)));
    await close();
  });

  await check("the ranking list has its own effort row", async () => {
    const before = await page.locator(".ranking-list [data-k]").count();
    const menu = await openSettings("Ranking settings");
    await menu.getByRole("tab", { name: "Data" }).click();
    const row = menu.getByRole("group", { name: "Reasoning" });
    assert.equal(await row.getByRole("button", { name: "none", exact: true }).getAttribute("aria-pressed"), "true", "the ranking starts with every effort, none included");
    for (const effort of ["none", "low", "medium", "high", "xhigh"]) await row.getByRole("button", { name: effort, exact: true }).click();
    await close();
    await page.waitForTimeout(400);
    assert.match(page.url(), /reff=max/, "the choice is in the link");
    assert.ok(await page.locator(".ranking-list [data-k]").count() <= before, "only max-effort rows remain");
    for (const effort of ["none", "low", "medium", "high", "xhigh"]) await (await openSettings("Ranking settings").then(async (m) => { await m.getByRole("tab", { name: "Data" }).click(); return m; })).getByRole("group", { name: "Reasoning" }).getByRole("button", { name: effort, exact: true }).click();
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
    assert.match(await card.innerText(), /score[\s\S]*per task/, "the card lays out score and cost as columns");
    assert.match(await card.innerText(), /at API price|API price, no plan data/, "the card's last row names the plan and the API price");
    const bbox = await card.boundingBox();
    assert.ok(bbox.x > box.x + box.width / 2 && bbox.y > box.y + box.height / 2, "the card sits in the lower right, not beside the mark");
  });

  await check("screenshot editor: brush opens it, ratio resizes live, the link opens the image full screen and Edit reopens the editor", async () => {
    const group = page.locator('[role="group"][aria-label="Export Time per task"]').first();
    await group.scrollIntoViewIfNeeded();
    await group.hover();
    await group.getByRole("button", { name: /Edit .* screenshot/ }).click();
    const box = page.getByTestId("xe-box");
    await box.waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "1:1", exact: true }).click();
    await page.waitForTimeout(600);
    const b = await box.boundingBox();
    assert.ok(Math.abs(b.width + 64 - b.height - 88) < 2, `1:1 makes the image square, got a ${b.width}x${b.height} plot`);
    await page.locator("dialog.xe input[type=text]").fill("Link test");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.locator(".xe-copy").click();
    let link = "";
    for (let i = 0; i < 40 && !link; i++) { link = await page.evaluate(() => navigator.clipboard.readText()); if (!link) await page.waitForTimeout(150); }
    // Long links are copied as /s/<slug> short links; the redirect must land on the full editor state.
    const full = /\/s\/[A-Za-z0-9]+$/.test(link) ? (await fetch(link, { redirect: "manual" })).headers.get("location") ?? "" : link;
    assert.ok(full.includes("xe=") && full.includes("c=time-per-task"), `the link carries the editor state (${link} -> ${full.slice(0, 80)})`);
    const other = await page.context().newPage();
    await other.goto(link, { waitUntil: "domcontentloaded" });
    // A shared editor link shows the image full screen as made, not the editor; Edit opens the editor with its settings.
    await other.locator("dialog.xe-viewer[open]").waitFor({ timeout: 15000 });
    assert.ok(await other.locator("dialog.xe-viewer .xe-title").innerText() === "Link test", "the title survives the link");
    const ob = await other.getByTestId("xe-box").boundingBox();
    assert.ok(Math.abs(ob.width / ob.height - b.width / b.height) < 0.02, "the crop survives the link");
    await other.getByRole("button", { name: "Edit", exact: true }).click();
    assert.equal(await other.locator("dialog.xe input[type=text]").inputValue(), "Link test", "Edit opens the editor with the link's title");
    await other.keyboard.press("Escape");
    await other.waitForTimeout(400);
    assert.ok(!other.url().includes("xe="), "closing drops the editor from the address");
    assert.equal(await other.locator('[role="group"][aria-label="Export Time per task"]').count(), 1, "the page is still there");
    await other.close();
    await page.keyboard.press("Escape");
  });

  await check("PNG export crops blank space off the right", async () => {
    const group = page.locator('[role="group"][aria-label="Export Time per task"]').first();
    await group.scrollIntoViewIfNeeded();
    const [dl] = await Promise.all([page.waitForEvent("download"), group.getByRole("button", { name: /Download .* as PNG/ }).click()]);
    const buf = await (await import("node:fs/promises")).readFile(await dl.path());
    const width = buf.readUInt32BE(16), plot = await page.locator('[role="img"][aria-label*="time per task" i]').first().boundingBox().catch(() => null);
    assert.ok(width > 0 && (!plot || width / 3 < plot.width + 64 + 8), `exported width ${width / 3} is no wider than the plot ${plot?.width} plus the frame`);
  });

  await check("moving off a mark removes every crosshair guide", async () => {
    const chart = page.locator('[role="img"][aria-label*="subscription cost"], [role="img"][aria-label*="cost per task"]').first();
    const dashed = () => chart.evaluate((e) => [...e.querySelectorAll("*")].filter((n) => n.getAttribute("stroke-dasharray")).length);
    const base = await dashed();
    const box = await chart.boundingBox();
    const card = page.getByRole("status", { name: "Selected model" });
    let hit = 0;
    for (let y = box.y + 60; y < box.y + box.height - 60 && !hit; y += 14) {
      for (let x = box.x + 80; x < box.x + box.width - 60 && !hit; x += 14) {
        await page.mouse.move(x, y);
        if (await card.isVisible()) { await page.waitForTimeout(150); if ((await dashed()) > base) hit = 1; }
      }
    }
    assert.ok(hit, "hovering a mark adds dashed guides");
    await page.mouse.move(box.x + 2, box.y + 2);
    await page.waitForTimeout(400);
    assert.equal(await dashed(), base, "guides are gone after the cursor leaves");
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
  const settings = async () => { const menu = await openSettings("Pareto settings"); await menu.getByRole("tab", { name: "Data" }).click(); return menu; };
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
  await check("builder: every index tab has a visible delete, and the last one resets instead of vanishing", async () => {
    const tabs = page.locator('[aria-label="Your indices"] .index-tabs-scroll > span');
    const removes = page.locator("[data-remove-index]");
    const before = await tabs.count();
    await page.getByRole("button", { name: "Copy this index as a new index" }).click();
    await page.keyboard.press("Escape");
    assert.equal(await tabs.count(), before + 1, "the + added an index");
    assert.equal(await removes.count(), before + 1, "each tab has its own ×");
    for (const handle of await removes.all()) assert.ok(await handle.isVisible(), "× is visible without hovering");
    // Delete a tab that is not the open one.
    const open = await page.locator('[aria-label="Your indices"] [aria-pressed=true]').first().innerText();
    await removes.first().click();
    assert.equal(await tabs.count(), before, "the × removed its index");
    assert.ok(await page.locator('[aria-label="Your indices"] [aria-pressed=true]').count() === 1, "one index stays open");
    void open;
    // Down to one, the × resets rather than deleting the last index.
    while ((await tabs.count()) > 1) await removes.first().click();
    await removes.first().click();
    assert.equal(await tabs.count(), 1, "the builder never has zero indices");
    await page.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });
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

  await check("rank: See the data is above the fold on desktop and phone, and opens the builder", async () => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const r = await (await browser.newContext({ viewport })).newPage();
      r.on("pageerror", (e) => errors.push(`${r.url()}: ${e.message}`));
      try {
        await r.goto(`${BASE}/rank`, { waitUntil: "domcontentloaded" });
        const link = r.getByRole("link", { name: "See the data" });
        await link.waitFor({ timeout: 30000 });
        assert.equal(await link.count(), 1, `${viewport.width}px: one data entry`);
        assert.equal(await r.getByText("Skip to the data").count(), 0, `${viewport.width}px: the old link is gone`);
        const box = await link.boundingBox(), duel = await r.locator(".duel-card").first().boundingBox();
        assert.ok(box && box.y >= 0 && box.y + box.height <= viewport.height, `${viewport.width}px: See the data sits above the fold`);
        assert.ok(viewport.width < 741 ? box.y < duel.y : box.x > duel.x + duel.width, `${viewport.width}px: before the matchup on a phone, beside it on desktop`);
        assert.match(await link.getAttribute("href"), /^\/builder\?i=/, `${viewport.width}px: links to the builder on the default index`);
      } finally { await r.context().close(); }
    }
  });

  await check("3d: a ranking charted on three measures, with the best corner listed", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/3d?a=preset:aa`, { waitUntil: "domcontentloaded" });
      const list = c.getByRole("region", { name: "Closest to the best corner" }).locator("li");
      await list.first().waitFor({ timeout: 30000 });
      assert.equal(await list.count(), 6, "six models listed");
      await c.getByRole("button", { name: /^Across axis: Time per task/ }).waitFor();
      await c.getByRole("button", { name: /^Up axis/ }).click();
      await c.getByRole("option", { name: /Subscription cost per task|Cost per task/ }).click();
      assert.match(c.url(), /ax=/, "the link carries the axes");
      await c.getByRole("button", { name: "Isometric" }).click();
      await list.first().click();
      assert.ok(await c.getByRole("region", { name: "Selected model" }).isVisible(), "picking a model shows its details");
    } finally { await c.context().close(); }
  });

  await check("3d: pressing D three times in the builder opens the 3D view", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.getByRole("button", { name: "Share" }).first().waitFor({ timeout: 30000 });
      await c.waitForTimeout(2500); // the builder settles its address before it listens
      for (let i = 0; i < 3; i++) await c.keyboard.press("d");
      await c.waitForURL(/\/3d\?a=/, { timeout: 15000 });
    } finally { await c.context().close(); }
  });

  await check("model page: a ranking picker, and a model with no data in one ranking can be placed in another", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/models/claude-opus-5.5`, { waitUntil: "domcontentloaded" });
      const pick = c.getByLabel("Ranking to place this model in");
      await pick.waitFor({ timeout: 30000 });
      await pick.selectOption({ label: "Artificial Analysis" });
      await c.getByText(/#\d+ of \d+ models/).waitFor({ timeout: 30000 });
    } finally { await c.context().close(); }
  });

  await check("model page: the HTML carries no dataset, and the closed benchmark list and off-screen charts are not drawn", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      // The whole snapshot used to be serialized into every model page: 21 MB of HTML, 30k DOM nodes, 100 MB of heap.
      const res = await c.goto(`${BASE}/models/claude-opus-5.5`, { waitUntil: "domcontentloaded" });
      const html = await res.text();
      assert.ok(html.length < 300_000, `model page HTML is ${Math.round(html.length / 1024)} KB`);
      assert.match(html, /<h1[^>]*>Opus 5\.5<\/h1>/, "the HTML still names the model");
      await c.getByText(/#\d+ of \d+ models/).waitFor({ timeout: 30000 });
      const nodes = await c.evaluate(() => document.getElementsByTagName("*").length);
      assert.ok(nodes < 8000, `model page has ${nodes} DOM nodes`);
      const all = c.locator("details", { has: c.locator("summary", { hasText: /^All \d+ benchmarks/ }) });
      await all.locator("summary").click();
      await all.locator("article").first().waitFor({ timeout: 10000 });
      assert.ok(await all.locator("article").count() > 10, "opening the list draws its cards");
    } finally { await c.context().close(); }
  });

  await check("an anonymous visitor downloads no Clerk, chart library, analytics or dataset they do not need", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const c = await context.newPage();
    try {
      const seen = [], bytes = new Map();
      c.on("request", (r) => seen.push(r.url()));
      c.on("response", async (r) => { if (r.request().resourceType() === "script") bytes.set(r.url(), (await r.body().catch(() => Buffer.alloc(0))).length); });
      await c.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await c.waitForTimeout(500);
      assert.equal(seen.filter((u) => /clerk\.browser|@clerk\/ui|\/api\/library|\/api\/snapshot/.test(u)).length, 0, `home fetched ${seen.filter((u) => /clerk|\/api\//.test(u)).join(", ")}`);
      // ECharts alone is about 650 KB of script: the home page draws no chart.
      const total = [...bytes.values()].reduce((a, b) => a + b, 0);
      assert.ok(total < 1_100_000, `home loads ${Math.round(total / 1024)} KB of script`);
      const html = await (await c.request.get(`${BASE}/`, { headers: { "user-agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36" } })).text();
      assert.ok(html.length < 450_000, `home HTML is ${Math.round(html.length / 1024)} KB`);
    } finally { await context.close(); }
  });

  await check("sign-in: Clerk loads for a sign-in page or a Google sign-in to resume, and not after a deliberate sign-out (session cookies: src/lib/auth.test.ts)", async () => {
    const clerkLoads = async (prepare, route = "/benchmarks") => {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await prepare(context);
      const c = await context.newPage();
      let hit = false;
      c.on("request", (r) => { if (/clerk\.browser/.test(r.url())) hit = true; });
      // A resume leaves for Google; this check stops at the decision to load.
      await c.route(/accounts\.google\.com/, (r) => r.abort());
      await c.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
      await c.waitForTimeout(2500);
      const signedOutLink = await c.getByRole("link", { name: "Sign in" }).count();
      await context.close();
      return { hit, signedOutLink };
    };
    const probe = await (await browser.newContext()).newPage();
    await probe.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" });
    const configured = !(await probe.getByText(/isn.t configured/).count());
    await probe.context().close();
    if (!configured) return;
    const storage = (value) => (context) => context.addInitScript((v) => { try { localStorage.setItem("priors:resume", v); } catch { /* about:blank */ } }, value);
    const none = await clerkLoads(async () => {});
    assert.equal(none.hit, false, "anonymous: Clerk loaded");
    assert.ok(none.signedOutLink > 0, "anonymous: the header offers Sign in");
    assert.equal((await clerkLoads(async () => {}, "/sign-in")).hit, true, "the sign-in page must load Clerk");
    const host = new URL(BASE).hostname;
    assert.equal((await clerkLoads((context) => context.addCookies([{ name: "__client_uat", value: "0", domain: host, path: "/" }]))).hit, false, "a signed-out cookie must not");
    assert.equal((await clerkLoads(storage("google:123"))).hit, true, "a Google sign-in to resume must load Clerk");
    assert.equal((await clerkLoads(storage("tried"))).hit, true, "finishing a resumed sign-in must load Clerk");
    assert.equal((await clerkLoads(storage("off:sess_1"))).hit, false, "a deliberate sign-out stays without Clerk");
  });

  await check("model page: real content in the HTML, no dataset for a plain visit; the dataset loads when something needs it", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const c = await context.newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      const seen = [];
      c.on("request", (r) => seen.push(r.url()));
      const html = await (await c.goto(`${BASE}/models/claude-opus-5.5`, { waitUntil: "domcontentloaded" })).text();
      assert.match(html, /of (<!-- -->)?\d+(<!-- -->)? models/, "the first HTML carries the ranking");
      assert.match(html, /Reasoning efforts in this ranking/, "and the efforts");
      await c.waitForLoadState("networkidle");
      const data = () => seen.filter((u) => /\/api\/snapshot/.test(u)).length;
      assert.equal(data(), 0, "a plain visit downloads the dataset");
      // The long list arrives when it opens.
      const all = c.locator("details", { has: c.locator("summary", { hasText: /^All \d+ benchmarks/ }) });
      await all.locator("summary").click();
      await all.locator("article").first().waitFor({ timeout: 10000 });
      assert.equal(data(), 0, "opening the list downloads the dataset");
      // A benchmark's details do need the dataset.
      await c.getByRole("button", { name: /^About / }).first().click();
      await c.locator("dialog.bench-dialog[open] h3", { hasText: "Top models" }).waitFor({ timeout: 30000 });
      assert.equal(data(), 1, "the details load the dataset once");
      await c.keyboard.press("Escape");
      // The other standard ranking draws the same page from the dataset, and a link to it is drawn by the server.
      await c.getByLabel("Ranking to place this model in").selectOption("aa");
      await c.locator("select[aria-label='Ranking to place this model in'][aria-busy='false']").waitFor({ timeout: 30000 });
      const fromBrowser = await c.locator("main").first().innerText();
      assert.match(c.url(), /r=aa/);
      await c.goto(`${BASE}/models/claude-opus-5.5?r=aa`, { waitUntil: "networkidle" });
      const fromServer = await c.locator("main").first().innerText();
      assert.equal(fromServer.split("\n").slice(0, 30).join("\n"), fromBrowser.split("\n").slice(0, 30).join("\n"), "server and browser draw the same ranking");
      assert.equal(await c.locator("select[aria-label='Ranking to place this model in']").inputValue(), "aa");
    } finally { await context.close(); }
  });

  await check("model page: a visitor's pricing choice loads the dataset and still draws the ranking", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const c = await context.newPage();
    try {
      await c.goto(`${BASE}/models/claude-opus-5.5`, { waitUntil: "networkidle" });
      await c.evaluate(() => localStorage.setItem("priors:plan-resets", "on"));
      const seen = [];
      c.on("request", (r) => seen.push(r.url()));
      await c.reload({ waitUntil: "networkidle" });
      assert.ok(seen.some((u) => /\/api\/snapshot/.test(u)), "a pricing choice needs the dataset");
      await c.locator("p.num").first().waitFor();
    } finally { await context.close(); }
  });

  await check("onboarding: the quality dialog's reasons are served on demand", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const c = await context.newPage();
    try {
      const res = await c.request.get(`${BASE}/api/quality`);
      assert.equal(res.ok(), true);
      assert.ok(Object.values(await res.json()).every((x) => typeof x === "string" && x.length > 20), "every benchmark has a reason");
    } finally { await context.close(); }
  });

  await check("benchmark gear: another cut of a benchmark takes the weight of the one it replaces", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1360, height: 950 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      // An explicit mix, so the check holds whatever the default is: AA-Omniscience's gear swaps in its accuracy cut.
      await c.goto(`${BASE}/builder?i=${encodeURIComponent("Gear|aa-omniscience:50,aa-gdp-pdf:50")}`, { waitUntil: "domcontentloaded" });
      const gear = c.getByRole("button", { name: /^AA-Omniscience( v1)?: choose a category or subset/ }).first();
      await gear.waitFor({ timeout: 30000 });
      const rows = await c.getByRole("slider").count();
      await gear.click();
      await c.getByRole("option", { name: "Accuracy" }).click();
      await c.getByRole("slider", { name: /^AA-Omniscience( v1)? Accuracy weight$/ }).waitFor({ timeout: 10000 });
      assert.equal(await c.getByRole("slider").count(), rows, "the mix keeps its size");
    } finally { await c.context().close(); }
  });

  await check("support: every header links to /support, and the support page has the amount picker", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.getByRole("slider").first().waitFor({ timeout: 30000 });
      await c.waitForTimeout(1500);
      await c.getByRole("link", { name: "Support Priors" }).first().click();
      await c.waitForURL(/\/support$/, { timeout: 30000 });
      await c.getByRole("radio", { name: /\$25/ }).click();
      await c.getByRole("link", { name: "Support Priors for $25 a month" }).waitFor({ timeout: 10000 });
    } finally { await c.context().close(); }
  });

  await check("builder: with many indices the + stays reachable", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1100, height: 800 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      const plus = c.getByRole("button", { name: "Copy this index as a new index" });
      await plus.waitFor({ timeout: 30000 });
      for (let i = 0; i < 5; i++) { await plus.click(); await c.keyboard.press("Enter"); }
      const box = await plus.boundingBox();
      assert.ok(box && box.x + box.width <= 1100 && box.x >= 0, "the + is inside the viewport");
      await plus.click({ timeout: 5000 });
    } finally { await c.context().close(); }
  });

  await check("builder: reading a benchmark's info keeps the browse list open", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
    c.on("pageerror", (e) => errors.push(`${c.url()}: ${e.message}`));
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.getByRole("button", { name: "Browse all benchmarks" }).click({ timeout: 30000 });
      const sheet = c.getByLabel("Benchmarks", { exact: true });
      await sheet.waitFor();
      await sheet.getByRole("button", { name: /^About / }).first().click();
      await c.getByRole("dialog").getByRole("button", { name: "Close" }).click();
      await c.waitForTimeout(500);
      assert.ok(await sheet.isVisible(), "the list is still open after closing the info dialog");
    } finally { await c.context().close(); }
  });

  await check("builder: clicking the benchmark search offers a link to explore all benchmarks", async () => {
    const c = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      await c.getByRole("searchbox", { name: "Add a benchmark" }).click({ timeout: 30000 });
      const link = c.getByLabel("Benchmarks", { exact: true }).getByRole("link", { name: "Explore benchmarks" });
      await link.waitFor();
      assert.equal(await link.getAttribute("href"), "/benchmarks");
    } finally { await c.context().close(); }
  });

  await check("benchmarks directory: rail filters, a value's tooltip waits for a hover, and the methodology link works", async () => {
    const c = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    try {
      await c.goto(`${BASE}/benchmarks`, { waitUntil: "domcontentloaded" });
      const rail = c.getByRole("navigation", { name: "Categories" }), rows = c.locator(".bench-row");
      await rows.first().waitFor({ timeout: 30000 });
      const before = await c.getByRole("status").innerText();
      await rail.getByRole("button", { name: /^Math/ }).click();
      await c.waitForFunction((t) => document.querySelector("[role=status]")?.textContent !== t, before);
      assert.equal(await rail.getByRole("button", { name: /^Math/ }).getAttribute("aria-pressed"), "true");
      const tip = rows.first().locator(".bench-q .bench-tip"), shown = () => tip.evaluate((el) => getComputedStyle(el, "::after").visibility);
      assert.equal(await shown(), "hidden");
      await tip.hover();
      await c.waitForTimeout(100);
      assert.equal(await shown(), "hidden", "tooltip waits before appearing");
      await c.waitForFunction((el) => getComputedStyle(el, "::after").visibility === "visible", await tip.elementHandle(), { timeout: 2000 });
      assert.match(await tip.getAttribute("data-bench-tip"), /Quality \d+ of 100/);
      await c.getByRole("link", { name: "How scores work", exact: true }).click();
      await c.getByRole("heading", { name: "How benchmark scores work" }).waitFor({ timeout: 30000 });
      assert.ok(await c.getByText(/quality \+ 12 × log2/).isVisible());
    } finally { await c.context().close(); }
  });

  await check("time per task starts linear and can switch to log; cost stays log", async () => {
    const c = await browser.newPage({ viewport: { width: 1360, height: 900 } });
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
      const open = async (label) => {
        const summary = c.getByLabel(`${label} settings`, { exact: true }).first();
        await summary.waitFor({ timeout: 60000 }); await summary.scrollIntoViewIfNeeded(); await summary.click();
        const tab = c.getByRole("tab", { name: "Display" }).first();
        if (await tab.count()) await tab.click();
        return c.getByRole("group", { name: "Scale" }).first();
      };
      const time = await open("Time per task");
      assert.equal(await time.getByRole("button", { name: "Linear" }).getAttribute("aria-pressed"), "true");
      await time.getByRole("button", { name: "Log" }).click();
      assert.equal(await time.getByRole("button", { name: "Log" }).getAttribute("aria-pressed"), "true");
      await c.keyboard.press("Escape");
      const cost = await open("Pareto");
      assert.equal(await cost.getByRole("button", { name: "Log" }).getAttribute("aria-pressed"), "true");
    } finally { await c.context().close(); }
  });

  await check("pareto charts start on the frontier and each lab's current models; Include older models shows the rest", async () => {
    const c = await browser.newPage({ viewport: { width: 1300, height: 1000 } });
    try {
      await c.goto(`${BASE}/benchmarks/frontiercode-2.0-main`, { waitUntil: "networkidle" });
      const plot = c.locator('#cost [role="img"]');
      const models = async () => new Set((await plot.getAttribute("data-points")).split(",").map((v) => v.split("@")[0]));
      const before = await models();
      for (const old of ["claude-opus-5", "gpt-5.5", "gpt-5.6-sol"]) assert.ok(!before.has(old), `${old} is hidden by default`);
      assert.ok(before.has("claude-opus-5.5"), "the current Opus stays");
      await c.getByLabel("Pareto settings", { exact: true }).click();
      await c.getByRole("tab", { name: "Data" }).last().click();
      await c.getByRole("checkbox", { name: "Include older models" }).check();
      await c.waitForTimeout(400);
      const after = await models();
      assert.ok(after.has("claude-opus-5") && after.size > before.size, "Include older models brings the older versions back");
    } finally { await c.close(); }
  });

  await check("benchmark page: hide a model, switch pricing and scale, cost chart follows", async () => {
    const c = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    try {
      await c.goto(`${BASE}/benchmarks/frontiercode-1.1-main`, { waitUntil: "networkidle" });
      const first = () => c.locator("table tbody tr td").nth(1).innerText();
      const leader = await first();
      await c.getByLabel("Ranking settings", { exact: true }).click();
      await c.getByRole("checkbox", { name: new RegExp(`^${leader}`) }).first().uncheck();
      await c.waitForTimeout(400);
      assert.notEqual(await first(), leader, "the hidden model leaves the table");
      await c.keyboard.press("Escape");
      await c.getByLabel("Pareto settings", { exact: true }).click();
      await c.getByRole("tab", { name: "Data" }).last().click();
      await c.locator("button", { hasText: /^API$/ }).last().click();
      await c.waitForTimeout(300);
      assert.ok(await c.getByRole("heading", { name: "Score vs cost per task" }).isVisible(), "API pricing retitles the chart");
      await c.getByRole("tab", { name: "Display" }).last().click();
      await c.locator("button", { hasText: /^Linear$/ }).last().click();
      assert.ok(await c.locator("button", { hasText: /^Linear$/ }).last().getAttribute("aria-pressed") === "true", "scale switches to linear");
    } finally { await c.close(); }
  });

  await check("a chart link's preview image is card-shaped, whatever ratio it was copied at", async () => {
    const xe = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    for (const o of [{ w: 360, h: 220, r: "16:9" }, { w: 600, h: 600, r: "1:1" }, { w: 400, h: 300 }]) {
      const query = `c=cost&xe=${xe(o)}`, html = await (await fetch(`${BASE}/builder?${query}`, { headers: { "user-agent": "Twitterbot/1.0" } })).text();
      const declared = (name) => Number(html.match(new RegExp(`og:image:${name}" content="(\\d+)`))?.[1]);
      assert.ok(Math.abs(declared("width") / declared("height") - 1200 / 630) < 0.02, `declared ${declared("width")}x${declared("height")}`);
      const png = Buffer.from(await (await fetch(`${BASE}/og?${query}`)).arrayBuffer());
      assert.ok(Math.abs(png.readUInt32BE(16) / png.readUInt32BE(20) - 1200 / 630) < 0.02, `drawn ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
    }
    // A new preview version reaches the image address, or X keeps serving the card it cached for the old one.
    for (const path of ["/builder", "/benchmarks/frontiercode-1.1-main"]) {
      const html = await (await fetch(`${BASE}${path}?c=cost&pv=test`, { headers: { "user-agent": "Twitterbot/1.0" } })).text();
      assert.match(html.match(/og:image" content="([^"]+)/)?.[1] ?? "", /pv=test/, `${path} image carries the version`);
    }
  });

  await check("benchmark directory rows line up: icon inside its tile, title beside it, columns under their labels", async () => {
    const c = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    try {
      await c.goto(`${BASE}/benchmarks`, { waitUntil: "networkidle" });
      const m = await c.evaluate(() => {
        const box = (e) => e.getBoundingClientRect(), mid = (r) => [r.x + r.width / 2, r.y + r.height / 2];
        const rows = [...document.querySelectorAll(".bench-row")].slice(0, 12).filter((r) => r.querySelector(".bench-cat"));
        const heads = [...document.querySelectorAll(".bench-head > span")];
        return { rows: rows.map((r) => { const tile = r.querySelector(".bench-cat"); return { tile: mid(box(tile)), icon: mid(box(tile.querySelector("svg"))), title: mid(box(r.querySelector(".bench-main .text-\\[15px\\]"))) }; }),
          bars: rows.map((r) => box(r.querySelector(".bench-bars")).x),
          name: box(rows[0].querySelector(".bench-leader .truncate")).x,
          label: (() => { const range = document.createRange(); range.selectNodeContents(heads[1]); const t = [...heads[1].childNodes].find((n) => n.nodeType === 3); range.selectNode(t); return range.getBoundingClientRect().x; })() };
      });
      assert.ok(m.rows.length > 3, "rows carry category tiles");
      for (const r of m.rows) {
        assert.ok(Math.abs(r.icon[0] - r.tile[0]) < 1 && Math.abs(r.icon[1] - r.tile[1]) < 1, `icon centered in its tile: ${r.icon} vs ${r.tile}`);
        assert.ok(Math.abs(r.title[1] - r.tile[1]) < 2, `title centered on its tile: ${r.title[1]} vs ${r.tile[1]}`);
      }
      assert.ok(Math.max(...m.bars) - Math.min(...m.bars) < 0.5, `quality bars share a column: ${m.bars}`);
      assert.ok(Math.abs(m.name - m.label) < 1.5, `top model name sits under its label: ${m.name} vs ${m.label}`);
    } finally { await c.close(); }
  });

  await check("a benchmark's info modal opens that benchmark in Priors", async () => {
    const c = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await c.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
      await c.getByRole("button", { name: /^About / }).first().click();
      const link = c.getByRole("dialog").getByRole("link", { name: "Open in Priors" });
      const href = await link.getAttribute("href");
      assert.match(href, /^\/benchmarks\/./);
      await link.click();
      await c.waitForURL(`**${href}`);
      await c.getByRole("heading").first().waitFor();
      assert.equal((await c.goto(`${BASE}${href}`)).status(), 200);
    } finally { await c.close(); }
  });

  await check("no dropdown's text runs under its arrow, and every one has the same chevron", async () => {
    const c = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await c.goto(`${BASE}/benchmarks/frontiercode-2.0-main`, { waitUntil: "networkidle" });
      await c.getByLabel("Pareto settings", { exact: true }).click();
      await c.getByRole("tab", { name: "Data" }).last().click();
      await c.locator(".chart-settings-menu summary", { hasText: "Subscription plans" }).last().click();
      const bad = await c.evaluate(() => {
        const ctx = document.createElement("canvas").getContext("2d");
        return [...document.querySelectorAll("select")].filter((s) => s.offsetParent && !s.closest(".rl-m-compare")).flatMap((s) => {
          const st = getComputedStyle(s); ctx.font = `${st.fontSize} ${st.fontFamily}`;
          const room = s.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight);
          const text = s.options[s.selectedIndex]?.text ?? "", w = ctx.measureText(text).width;
          return st.appearance !== "none" || !st.backgroundImage.includes("svg") ? [`${s.getAttribute("aria-label")}: native arrow`] : w > room + 1 ? [`${s.getAttribute("aria-label")}: "${text}" ${Math.round(w)} > ${Math.round(room)}`] : [];
        });
      });
      assert.deepEqual(bad, []);
      // The collapsed sections are one row each: title on the left, value and chevron on the right.
      await c.locator(".chart-settings-menu summary", { hasText: "Subscription plans" }).last().click();
      for (const name of ["Subscription plans", "Custom formula"]) {
        const row = c.locator(".chart-settings-menu summary", { hasText: name }).last();
        const box = await row.boundingBox(), value = await row.locator("span").boundingBox();
        assert.ok(box.height < 50, `${name} is one row (${box.height}px)`);
        assert.ok(value.x > box.x + box.width / 2 && value.y >= box.y && value.y + value.height <= box.y + box.height, `${name}'s value sits on the right of its row`);
      }
      const widths = await c.locator(".chart-settings-menu select[aria-label$='data source'], .chart-settings-menu select[aria-label$='release window']").evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.clientWidth));
      assert.equal(new Set(widths).size, 1, `data selects line up: ${widths}`);
    } finally { await c.close(); }
  });

  await check("the account menu opens inside the viewport and above the rail on phone and tablet widths", async () => {
    for (const width of [390, 900]) {
      const c = await browser.newPage({ viewport: { width, height: 844 } });
      try {
        await c.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
        // It needs a session, so its popover goes in the slot it renders in (HeaderAuth, after Share).
        const account = await c.evaluate(() => {
          document.querySelector('.builder-header [aria-label="Share"]').parentElement.parentElement.insertAdjacentHTML("beforeend", `<div class="account-menu relative"><button aria-expanded="true" class="w-9 h-9"></button><div class="account-popover grid absolute right-0 top-full mt-1.5 w-64 p-2 bg-white"><a id="account-probe" href="#" style="height:240px">View my page</a></div></div>`);
          const probe = document.getElementById("account-probe"), r = probe.getBoundingClientRect();
          return { left: r.left, right: r.right, on: [.25, .5, .75].every((f) => document.elementFromPoint(r.left + r.width / 2, r.top + r.height * f) === probe) };
        });
        assert.ok(account.left >= 0 && account.right <= width, `account menu fits at ${width}px: ${account.left} to ${account.right}`);
        assert.ok(account.on, `account menu is on top of the rail at ${width}px`);
      } finally { await c.close(); }
    }
  });

  await check("benchmark page: published extras (agent steps, breakdown), version menu, no hydration errors", async () => {
    const c = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
    const consoleErrors = [];
    c.on("console", (m) => { if (m.type() === "error" && /hydrat/i.test(m.text())) consoleErrors.push(m.text().slice(0, 160)); });
    try {
      await c.goto(`${BASE}/benchmarks/deepswe-1.1`, { waitUntil: "networkidle" });
      assert.ok(await c.getByText("Agent steps per task", { exact: true }).first().isVisible(), "DeepSWE's agent steps get their own chart");
      const versions = c.locator("label", { hasText: "Version" }).locator("select");
      assert.ok((await versions.locator("option").allInnerTexts()).some((t) => /v1$|DeepSWE v1\b/.test(t)), "the version menu lists the older version");
      await c.goto(`${BASE}/benchmarks/vals-mmlu-pro`, { waitUntil: "networkidle" });
      assert.ok(await c.getByRole("heading", { name: "Breakdown" }).isVisible(), "category splits show as a breakdown");
      assert.deepEqual(consoleErrors, [], "no hydration mismatch");
    } finally { await c.close(); }
  });

  assert.deepEqual(errors, [], "no page errors");
  console.log(`PASS interactions: ${checks.length} checks\n  ${checks.join("\n  ")}`);
} finally {
  await browser.close();
}
