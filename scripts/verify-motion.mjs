import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const mix = "General%20frontier|aa-gdpval-aa:15,aa-terminalbench-v2-1:15,deepswe-1.1:15,terminalbench-4:10,arc-agi-3:10|cut=50";
try {
  await page.goto(`http://127.0.0.1:48740/?${new URLSearchParams({ i: mix })}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    window.motionSamples = [];
    window.interpolatedFrames = 0;
    window.stopSampling = false;
    const sample = () => {
      const rows = [...document.querySelectorAll("[data-k]")];
      if (rows.length) {
        const box = rows[0].parentElement.getBoundingClientRect();
        const overflow = Math.max(0, ...rows.map((r) => {
          const rect = r.getBoundingClientRect();
          return Math.max(box.top - rect.top, rect.bottom - box.bottom);
        }));
        window.motionSamples.push(overflow);
        if (rows.some((r, i) => Math.abs(r.getBoundingClientRect().top - box.top - i * 30) > 1)) window.interpolatedFrames++;
      }
      if (!window.stopSampling) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const slider = page.getByRole("slider", { name: "DeepSWE v1.1 weight", exact: true });
  for (const value of [60, 2, 50, 10, 40, 5, 60, 15, 55, 8, 45, 20]) {
    await slider.evaluate((el, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(value));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await page.waitForTimeout(35);
    await page.evaluate(() => window.scrollBy(0, 25));
  }
  await page.waitForTimeout(650);
  const result = await page.evaluate(() => { window.stopSampling = true; return { maxEscape: Math.max(...window.motionSamples), frames: window.motionSamples.length, interpolatedFrames: window.interpolatedFrames }; });
  console.log(result);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/priors-motion-after.png", fullPage: true });
  const chart = page.getByRole("img", { name: "Index score versus cost per task" });
  await chart.screenshot({ path: "/tmp/priors-labels-after.png" });
  assert(result.interpolatedFrames > 5, "rows should animate through intermediate positions, not jump");
  assert(result.frames > 20);
  assert(result.maxEscape < 2, `ranking rows escaped by ${result.maxEscape}px`);
  assert(await page.locator(".ranking-list").evaluate((el) => getComputedStyle(el).contain.includes("paint")));
  assert(await chart.evaluate((el) => getComputedStyle(el).overflow === "hidden"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(await page.locator("[data-k]").first().evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await chart.screenshot({ path: "/tmp/priors-labels-mobile.png" });
  assert.deepEqual(errors, []);
  console.log("Rapid slider interruptions and scrolling keep ranking rows inside their box.");
} finally { await browser.close(); }
