/**
 * End-to-end smoke check against a running dev server.
 *   BASE=http://localhost:48740 node scripts/verify/smoke.mjs
 * Loads every public route, then walks the ranking onboarding from the first matchup to the builder.
 * Fails on a non-200 route, a page error, or a missing landmark.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:48740";
const browser = await chromium.launch();
const errors = [];
const watch = (page) => page.on("pageerror", (e) => errors.push(`${page.url()}: ${e.message}`));

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  watch(page);

  // Routes: each loads and shows its landmark.
  const routes = [
    ["/builder", () => page.locator(".ranking-list [data-k]").first()],
    ["/explore", () => page.getByRole("heading").first()],
    ["/model-finder", () => page.getByRole("heading").first()],
    ["/skill", () => page.getByRole("heading").first()],
    ["/import", () => page.getByRole("heading").first()],
    ["/privacy", () => page.getByRole("heading").first()],
    ["/lab/themes", () => page.getByRole("group", { name: "Page theme" })],
    ["/lab/index", () => page.getByRole("group", { name: "Publishing placement" })],
  ];
  for (const [path, landmark] of routes) {
    const res = await page.goto(BASE + path, { waitUntil: "domcontentloaded" });
    assert.equal(res.status(), 200, `${path} status`);
    await landmark().waitFor({ timeout: 30000 });
  }

  // A model page, reached the way a visitor does.
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  const modelId = await page.locator(".ranking-list [data-k]").first().getAttribute("data-k");
  const model = await page.goto(`${BASE}/models/${encodeURIComponent(modelId.split("@")[0])}`, { waitUntil: "domcontentloaded" });
  assert.equal(model.status(), 200, "model page status");

  // Share card image.
  const card = await context.request.get(`${BASE}/og`);
  assert.equal(card.status(), 200, "/og status");
  assert.match(card.headers()["content-type"], /image\/png/, "/og is a PNG");

  // Onboarding: matchups, review list, search, result, builder.
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const rank = await fresh.newPage();
  watch(rank);
  await rank.goto(`${BASE}/rank`, { waitUntil: "domcontentloaded" });
  await rank.getByRole("region", { name: "Head-to-head matchups" }).waitFor();
  await rank.getByRole("button", { name: "How it works" }).click();
  await rank.locator(".intro-dialog[open]").waitFor();
  await rank.keyboard.press("Escape");
  const left = rank.getByRole("button", { name: "Left is better" });
  for (let calls = 0; calls < 20 && await left.isVisible(); calls++) { await left.click(); await rank.waitForTimeout(650); }
  await rank.getByRole("heading", { name: /Does this look right/ }).waitFor({ timeout: 10000 });
  const wanted = await rank.locator(".tactile-row").count();
  assert.ok(wanted >= 3, "review list has the lineup");
  await rank.getByRole("button", { name: /Looks right, find my index/ }).click();
  await rank.getByRole("region", { name: "Optimization monitor" }).waitFor();
  assert.equal(await rank.locator(".ladder-rows i").count(), wanted, "search panel shows one slot per model");
  await rank.getByRole("status", { name: "Search complete", exact: true }).waitFor({ timeout: 90000 });
  await rank.locator(".done-dialog[open]").waitFor({ timeout: 5000 });
  await rank.getByRole("link", { name: /Explore your index/ }).click();
  await rank.waitForURL(/\/builder\?/);
  await rank.locator(".ranking-list [data-k]").first().waitFor({ timeout: 30000 });

  assert.deepEqual(errors, [], "no page errors");
  console.log(`PASS smoke: ${routes.length + 2} routes, onboarding end to end (${wanted} models), no page errors`);
} finally {
  await browser.close();
}
