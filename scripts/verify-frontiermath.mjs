import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.TEST_URL ?? "http://127.0.0.1:48740";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const { snapshot } = await (await page.request.get(`${base}/api/snapshot`)).json();
  const benchmarks = snapshot.benchmarks.filter((b) => b.sourceId === "frontiermath");
  assert.equal(benchmarks.length, 3);
  for (const b of benchmarks) {
    const rows = snapshot.observations.filter((o) => o.benchmarkId === b.id);
    assert(rows.length > 0);
    console.log(b.name, rows.length, "results", new Set(rows.map((o) => o.variantId.split("@")[0])).size, "models");
  }
  const tier4 = snapshot.observations.filter((o) => o.benchmarkId === "frontiermath-tier-4-v2");
  assert(Math.abs(tier4.find((o) => o.variantId === "gpt-6-astra@max").value - 97.6) < 0.1);
  assert(Math.abs(tier4.find((o) => o.variantId === "claude-opus-5@max").value - 73.2) < 0.1);
  assert(tier4.some((o) => o.variantId === "gpt-6-astra@none"));
  assert(tier4.some((o) => o.variantId === "gpt-6-astra@low"));
  await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(await page.locator("header .wm").evaluate((el) => getComputedStyle(el).fontSize), "28px");
  await page.getByRole("searchbox", { name: "Add a benchmark" }).fill("FrontierMath");
  assert.equal(await page.locator('[aria-label="Available benchmarks"]').getByRole("button").count(), 3);
  await page.screenshot({ path: "/tmp/priors-frontiermath-search.png" });
  await page.locator('[aria-label="Available benchmarks"]').getByRole("button", { name: /FrontierMath Tier 4/ }).click();
  await page.getByRole("slider", { name: "FrontierMath Tier 4 (v2) weight", exact: true }).waitFor();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("slider", { name: "FrontierMath Tier 4 (v2) weight", exact: true }).waitFor();
  await page.goto(`${base}/?${new URLSearchParams({ i: "FrontierMath|frontiermath-tier-4-v2:100" })}`, { waitUntil: "networkidle" });
  assert(await page.locator("[data-k]").count() > 20);
  await page.getByRole("img", { name: "Index score versus cost per task" }).waitFor();
  await page.screenshot({ path: "/tmp/priors-frontiermath-ranking.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "/tmp/priors-frontiermath-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("Logo size, FrontierMath discovery/add/reload, scores, effort identity and responsive charts passed.");
} finally { await browser.close(); }
