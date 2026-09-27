import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.TEST_URL ?? "http://127.0.0.1:48749";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const mix = "Source check|terminalbench-4:50,aa-intelligence-index-v4.3.2:50|strict=0|after=";
async function settings(label) {
  const control = page.getByLabel(`${label} data source`, { exact: true });
  if (!await control.isVisible()) await page.getByLabel(`${label} settings`, { exact: true }).click();
  return control;
}
async function exported(name) {
  await page.getByRole("button", { name: `More export formats for ${name}`, exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "JSON", exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile(await download.path(), "utf8")).rows;
}
try {
  await page.goto(`${base}/builder?${new URLSearchParams({ i: mix })}`, { waitUntil: "networkidle" });
  assert.equal(await (await settings("Pareto")).inputValue(), "aa");
  const options = await page.getByLabel("Pareto data source", { exact: true }).locator("option").allTextContents();
  assert.equal(options.length, 4);
  assert(!options.some((s) => /vals/i.test(s)));
  assert(options.every((s) => /· \d+ models/.test(s)));
  await page.keyboard.press("Escape");
  const aa = await exported("Score vs cost per task");
  await (await settings("Pareto")).selectOption("terminalbench-4");
  await page.keyboard.press("Escape");
  const tb = await exported("Score vs cost per task");
  assert(tb.length > 0 && tb.length < aa.length);
  const snapshot = (await (await page.request.get(`${base}/api/snapshot`)).json()).snapshot;
  const raw = snapshot.observations.filter((o) => o.benchmarkId === "terminalbench-4");
  const firstByVariant = new Map();
  for (const o of raw) if (!firstByVariant.has(o.variantId)) firstByVariant.set(o.variantId, o);
  for (const row of tb) {
    const model = snapshot.models.find((m) => m.name === row.model);
    assert(model, JSON.stringify(row));
    const o = firstByVariant.get(`${model.id}@${row.effort}`);
    assert(o, JSON.stringify(row));
    const costKey = Object.keys(row).find((k) => k.includes("Cost per task"));
    assert(Math.abs(row[costKey] - o.costUsd) < 0.00011, JSON.stringify(row));
  }
  assert.equal(await (await settings("Time per task")).inputValue(), "aa", "selectors are independent");
  const timeOptions = await page.getByLabel("Time per task data source", { exact: true }).locator("option").allTextContents();
  await page.getByLabel("Time per task data source", { exact: true }).selectOption("terminalbench-4");
  await page.keyboard.press("Escape");
  const times = await exported("Time per task");
  assert(times.length > 0);
  for (const row of times) {
    const model = snapshot.models.find((m) => m.name === row.model);
    const o = firstByVariant.get(`${model.id}@${row.effort}`);
    const timeKey = Object.keys(row).find((k) => k.includes("Time per task"));
    assert(Math.abs(row[timeKey] - o.durationSec) < 0.00011, JSON.stringify(row));
  }
  await page.waitForTimeout(250);
  assert(new URL(page.url()).searchParams.get("i").includes("costsrc=terminalbench-4"));
  assert(new URL(page.url()).searchParams.get("i").includes("timesrc=terminalbench-4"));
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await (await settings("Pareto")).inputValue(), "terminalbench-4");
  await page.screenshot({ path: "/tmp/priors-sources-desktop.png" });
  await page.keyboard.press("Escape");
  assert.equal(await (await settings("Time per task")).inputValue(), "terminalbench-4");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await settings("Time per task");
  await page.waitForTimeout(300);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: "/tmp/priors-sources-mobile.png" });
  await page.keyboard.press("Escape");
  // Bars use the same selected measurements.
  await page.getByRole("group", { name: "Time per task chart type", exact: true }).getByTitle("Bar chart", { exact: true }).click();
  assert((await exported("Time per task")).length > 0);
  // Additional sources must render their own costs and durations and survive reload.
  const addedSources = [];
  for (const source of ["deepswe-1.1", "frontierswe-v2"]) {
    await page.goto(`${base}/builder?${new URLSearchParams({ i: mix })}`, { waitUntil: "networkidle" });
    await (await settings("Pareto")).selectOption(source);
    await page.keyboard.press("Escape");
    await (await settings("Time per task")).selectOption(source);
    await page.keyboard.press("Escape");
    await page.getByRole("group", { name: "Time per task chart type", exact: true }).getByTitle("Score vs metric", { exact: true }).click();
    const rows = snapshot.observations.filter((o) => o.benchmarkId === source);
    const first = new Map();
    for (const o of rows) if (!first.has(o.variantId)) first.set(o.variantId, o);
    for (const [chart, field, keyPattern] of [["Score vs cost per task", "costUsd", "Cost per task"], ["Time per task", "durationSec", "Time per task"]]) {
      const points = await exported(chart);
      assert(points.length > 0, `${source} ${field} has points`);
      for (const row of points) {
        const model = snapshot.models.find((m) => m.name === row.model);
        const o = first.get(`${model.id}@${row.effort}`);
        assert(o, `${source}: ${JSON.stringify(row)}`);
        const key = Object.keys(row).find((k) => k.includes(keyPattern));
        assert(Math.abs(row[key] - o[field]) < 0.00011, `${source}: ${JSON.stringify(row)}`);
      }
    }
    await page.waitForTimeout(250);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await (await settings("Pareto")).inputValue(), source);
    await page.keyboard.press("Escape");
    assert.equal(await (await settings("Time per task")).inputValue(), source);
    addedSources.push({ source, options: await page.getByLabel("Time per task data source", { exact: true }).locator("option").allTextContents() });
    await page.screenshot({ path: `/tmp/priors-${source}-mobile.png` });
    await page.keyboard.press("Escape");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await settings("Time per task");
  await page.screenshot({ path: "/tmp/priors-added-sources-desktop.png" });
  await page.keyboard.press("Escape");
  // Empty source coverage still leaves a working selector.
  const absent = snapshot.models.find((m) => !raw.some((o) => o.variantId.startsWith(m.id + "@")) && snapshot.observations.some((o) => o.benchmarkId.startsWith("aa-intelligence-index") && o.variantId.startsWith(m.id + "@")));
  assert(absent);
  await page.goto(`${base}/builder?${new URLSearchParams({ i: mix + `|only=${absent.id}|costsrc=terminalbench-4|timesrc=terminalbench-4` })}`, { waitUntil: "networkidle" });
  assert(await page.getByText("No model in this view has this metric.").count() > 0);
  await (await settings("Pareto")).selectOption("aa");
  assert.equal(await page.getByLabel("Pareto data source", { exact: true }).inputValue(), "aa");
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ base, costOptions: options, timeOptions, addedSources, aaPoints: aa.length, tbPoints: tb.length, timePoints: times.length, passed: "source switching, raw data parity, independent settings, reload, URL persistence, bars, empty state, desktop/mobile overflow", errors }, null, 2));
} finally { await browser.close(); }
