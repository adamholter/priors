/** After `npm run scrape -- --only scale-hss`, run `npx tsx scripts/verify/hss.ts`.
 * Set BASE=https://mypriors.com to verify the published benchmark and builder.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import type { Snapshot } from "../../src/data/types";
import { normalizeLabel } from "../../src/data/normalize";
import source, { HSS_ID, HSS_PAGE } from "../scrape/sources/scale-hss";
import { makeContext } from "../scrape/harness";

async function main() {
  const base = process.env.BASE ?? "http://127.0.0.1:48740";
  const live = await source.scrape(makeContext(source.id));
  const response = await fetch(`${base}/api/snapshot`);
  assert(response.ok, `Snapshot returned ${response.status}`);
  const { snapshot } = await response.json() as { snapshot: Snapshot };
  const benchmark = snapshot.benchmarks.find((b) => b.id === HSS_ID);
  assert(benchmark, "HSS missing from snapshot");
  assert.equal(benchmark.url, HSS_PAGE);
  const saved = snapshot.observations.filter((o) => o.benchmarkId === HSS_ID);
  assert.equal(saved.length, live.rows.length, "Snapshot must include every live model result");
  for (const row of live.rows) {
    const model = normalizeLabel(row.modelLabel, row.effort);
    assert(model.ok, `Unrecognized live model: ${row.modelLabel}`);
    const observation = saved.find((o) => {
      const variant = snapshot.variants.find((v) => v.id === o.variantId);
      return variant?.modelId === model.modelId && (!model.effort || variant.effort === model.effort);
    });
    assert(observation, `Missing model/effort: ${row.modelLabel}`);
    assert.equal(observation.value, row.value);
    assert.deepEqual(observation.ci, row.ci);
    assert.equal(observation.rank, row.rank);
    assert.equal(observation.sourceUrl, HSS_PAGE);
  }
  assert.equal(snapshot.sources.find((s) => s.sourceId === source.id)?.status, "ok");
  console.log(`Live source and saved snapshot agree on all ${saved.length} model results, efforts, scores and intervals.`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/builder`, { waitUntil: "networkidle" });
    const search = page.getByRole("searchbox", { name: "Add a benchmark" });
    const benchmarkRow = page.getByRole("checkbox", { name: /Humanity's Sixth Sense.*models/ });
    for (const query of ["Humanity", "HSS"]) {
      await search.fill(query);
      await benchmarkRow.waitFor();
    }
    await benchmarkRow.click();
    await page.keyboard.press("Escape");
    await page.getByRole("slider", { name: "Humanity's Sixth Sense weight", exact: true }).waitFor();
    await page.waitForURL((url) => url.searchParams.getAll("i").some((value) => value.includes(HSS_ID)));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("slider", { name: "Humanity's Sixth Sense weight", exact: true }).waitFor();

    const query = new URLSearchParams({ i: `HSS|${HSS_ID}:100|strict=100|est=0|after=|effort=strict` });
    await page.goto(`${base}/builder?${query}`, { waitUntil: "networkidle" });
    const rows = page.locator("[data-k]");
    await rows.first().waitFor();
    assert.equal(await rows.count(), saved.length);
    const leader = [...saved].sort((a, b) => b.value - a.value)[0];
    assert.equal(await rows.first().getAttribute("data-k"), leader.variantId);
    assert.equal(await rows.first().locator(".num").innerText(), leader.value.toFixed(1));
    await page.screenshot({ path: "/tmp/priors-hss-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile overflow");
    await page.screenshot({ path: "/tmp/priors-hss-mobile.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log("Builder search, add, reload, exact rankings and desktop/mobile checks passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
