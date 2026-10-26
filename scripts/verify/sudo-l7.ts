/** After `npm run scrape -- --only surge-sudo-l7`, run `npx tsx scripts/verify/sudo-l7.ts`.
 * Set BASE=https://mypriors.com to verify the published benchmark and builder.
 */
import assert from "node:assert/strict";
import { chromium } from "playwright";
import type { Snapshot } from "../../src/data/types";
import { normalizeLabel } from "../../src/data/normalize";
import source, { SUDO_L7_ID, SUDO_L7_PAGE } from "../scrape/sources/surge-sudo-l7";
import { makeContext } from "../scrape/harness";

async function main() {
  const base = process.env.BASE ?? "http://127.0.0.1:48748";
  const live = await source.scrape(makeContext(source.id));
  const response = await fetch(`${base}/api/snapshot`);
  assert(response.ok, `Snapshot returned ${response.status}`);
  const { snapshot } = await response.json() as { snapshot: Snapshot };
  const benchmark = snapshot.benchmarks.find((b) => b.id === SUDO_L7_ID);
  assert(benchmark, "sudo L7 missing from snapshot");
  assert.equal(benchmark.url, SUDO_L7_PAGE);
  const saved = snapshot.observations.filter((o) => o.benchmarkId === SUDO_L7_ID);
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
    assert.equal(observation.harness, row.harness);
    assert.equal(observation.rank, row.rank);
    assert.equal(observation.sourceUrl, SUDO_L7_PAGE);
  }
  assert.equal(snapshot.sources.find((s) => s.sourceId === source.id)?.status, "ok");
  console.log(`Live source and saved snapshot agree on all ${saved.length} model results, efforts, scores and harnesses.`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/builder`, { waitUntil: "networkidle" });
    const search = page.getByRole("searchbox", { name: "Add a benchmark" });
    const benchmarkRow = page.getByRole("checkbox", { name: /sudo L7.*models/ });
    for (const query of ["sudo", "L7"]) {
      await search.fill(query);
      await benchmarkRow.waitFor();
    }
    await benchmarkRow.click();
    await page.keyboard.press("Escape");
    await page.getByRole("slider", { name: "sudo L7 weight", exact: true }).waitFor();
    await page.waitForURL((url) => url.searchParams.getAll("i").some((value) => value.includes(SUDO_L7_ID)));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("slider", { name: "sudo L7 weight", exact: true }).waitFor();

    const query = new URLSearchParams({ i: `sudo L7|${SUDO_L7_ID}:100|strict=100|est=0|after=|effort=strict` });
    await page.goto(`${base}/builder?${query}`, { waitUntil: "networkidle" });
    const rows = page.locator(".ranking-list [data-k]");
    await rows.first().waitFor();
    assert.equal(await rows.count(), saved.length);
    for (const row of await rows.all()) {
      const id = await row.getAttribute("data-k");
      const observation = saved.find((o) => o.variantId === id);
      assert(observation, `Unexpected ranked variant: ${id}`);
      assert.equal(await row.locator(".num").innerText(), observation.value.toFixed(1));
    }
    const leader = [...saved].sort((a, b) => b.value - a.value)[0];
    assert.equal(await rows.first().getAttribute("data-k"), leader.variantId);
    assert.equal(await rows.first().locator(".num").innerText(), leader.value.toFixed(1));
    await page.screenshot({ path: "/tmp/priors-sudo-l7-desktop.png", fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Mobile overflow");
    await page.screenshot({ path: "/tmp/priors-sudo-l7-mobile.png", fullPage: true });
    assert.deepEqual(errors, []);
    console.log("Builder search, add, reload, exact rankings and desktop/mobile checks passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
