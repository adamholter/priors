// Mobile touch checks for the chart point card and the title info popover, on iPhone and Android profiles, light and dark,
// including a student plan option (Google AI Pro (Student)). Asserts placement (fully inside the visible viewport, above the browser toolbar
// reserve) and tap dismissal, and saves screenshots to SHOTS (default: scripts/verify/.shots, ignored) as a visual record.
//   BASE=http://localhost:48740 [SHOTS=~/data/priors/tooltip-fix/after] node scripts/verify/mobile-tooltips.mjs
import { chromium, devices } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:48740";
const SHOTS = resolve(process.env.SHOTS ?? "scripts/verify/.shots");
const CHARTS = (process.env.CHARTS ?? "cost,time-per-task").split(",");
const PROFILES = { iphone: devices["iPhone 14"], android: devices["Pixel 7"] };
// What the browser's own bottom bar can cover (Safari toolbar, home indicator): the card must end above this.
const RESERVE = 88, EDGE = 8;
mkdirSync(SHOTS, { recursive: true });
const b = await chromium.launch();
const fails = [];
const check = async (name, fn) => { try { await fn(); console.log(`ok   ${name}`); } catch (e) { fails.push(name); console.log(`FAIL ${name}\n     ${e.message.split("\n")[0]}`); } };
const inView = (r, vw, vh, what) => { assert.ok(r.left >= EDGE - 1 && r.right <= vw - EDGE + 1, `${what} sideways: ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`); assert.ok(r.top >= 0 && r.bottom <= vh - RESERVE + 1, `${what} vertical: ${Math.round(r.top)}..${Math.round(r.bottom)} of ${vh - RESERVE}`); };

for (const [pname, profile] of Object.entries(PROFILES)) for (const scheme of ["light", "dark"]) {
  const ctx = await b.newContext({ ...profile, colorScheme: scheme });
  const p = await ctx.newPage();
  const { width: vw, height: vh } = profile.viewport;
  await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await p.locator(".chart-toolbar").first().waitFor({ timeout: 60000 });
  await p.waitForTimeout(2500);
  const tag = `${pname}-${scheme}`;
  const shot = (name) => p.screenshot({ path: `${SHOTS}/${tag}-${name}.png` });
  const chartBox = (id) => p.locator(`#${id}`);
  for (const id of CHARTS) {
    const root = chartBox(id);
    if (!(await root.count())) { await check(`${tag} ${id}: chart exists`, () => assert.fail("no chart")); continue; }
    const plot = root.locator('[role="img"]').first();
    // Scroll so the plot's top sits near the top of the screen: its lower part, where the card used to sit, is below the fold.
    const placeAt = async (top) => { await plot.evaluate((el, t) => { window.scrollBy(0, el.getBoundingClientRect().top - t); }, top); await p.waitForTimeout(250); };
    const tap = async () => {
      const box = await plot.boundingBox();
      const pts = await plot.evaluate((el) => { const c = el.querySelector("canvas, svg"); return !!c; });
      assert.ok(pts, "plot drawn");
      // Tap the first drawn mark that opens a card: walk a coarse grid inside the plot until one does.
      const card = root.getByRole("status", { name: "Selected model" });
      for (let gy = 0.2; gy <= 0.8; gy += 0.1) for (let gx = 0.3; gx <= 0.95; gx += 0.05) {
        const x = box.x + box.width * gx, y = box.y + box.height * gy;
        if (y < 0 || y > vh - RESERVE) continue;
        await p.touchscreen.tap(x, y); await p.waitForTimeout(120);
        if (await card.count()) return card;
      }
      assert.fail("no tappable mark found");
    };
    await check(`${tag} ${id}: point card stays on screen`, async () => {
      for (const top of [60, 340]) {
        await placeAt(top);
        const card = await tap();
        await p.waitForTimeout(250);
        await shot(`${id}-card-${top}`);
        inView(await card.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }), vw, vh, "card");
        await p.mouse.move(0, 0);
      }
    });
    await check(`${tag} ${id}: tapping outside the chart dismisses the card`, async () => {
      await placeAt(60);
      const card = await tap();
      assert.equal(await card.count(), 1);
      const title = root.locator(".chart-toolbar").first();
      await p.touchscreen.tap(8, Math.max(4, (await title.boundingBox()).y - 4 > 0 ? (await title.boundingBox()).y - 4 : 4));
      await p.waitForTimeout(300);
      assert.equal(await root.getByRole("status", { name: "Selected model" }).count(), 0, "card still open");
    });
    await check(`${tag} ${id}: info popover stays on screen and a tap elsewhere closes it`, async () => {
      const info = root.locator(".chart-method button").first();
      if (!(await info.count())) return;
      await placeAt(120);
      await info.tap(); await p.waitForTimeout(250);
      await shot(`${id}-info`);
      const pop = root.locator(".chart-method-pop");
      inView(await pop.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }), vw, vh, "popover");
      await p.touchscreen.tap(vw / 2, vh - 160); await p.waitForTimeout(300);
      assert.equal(await pop.count(), 0, "popover still open");
    });
  }
  // A student plan option changes only the plan prices; the menu with the offer's terms and the point card must still fit.
  await check(`${tag}: student plan option, card still on screen`, async () => {
    const root = chartBox(CHARTS[0]);
    const details = root.locator("details", { has: p.locator("summary[aria-label$='settings']") }).first();
    await details.scrollIntoViewIfNeeded();
    await details.locator("summary").first().tap(); await p.waitForTimeout(300);
    const menu = details.locator(".chart-settings-menu");
    await menu.getByRole("tab", { name: "Data" }).tap();
    await menu.locator("summary", { hasText: "Subscription plans" }).tap();
    await menu.locator(".pp-lab[data-lab='google'] .pp-head").tap();
    const student = menu.getByRole("radiogroup", { name: "Google plan" }).getByRole("radio").filter({ has: p.locator(".pp-label", { hasText: /^Google AI Pro \(Student\)/ }) }).first();
    assert.ok(await student.count(), "Google AI Pro (Student) is a plan option");
    await student.tap();
    await menu.getByLabel("Student offer").waitFor();
    await shot("student-menu");
    const mr = await menu.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: 0, bottom: 0 }; });
    assert.ok(mr.left >= 0 && mr.right <= vw + 1, `menu sideways ${mr.left}..${mr.right}`);
    await details.locator("summary").first().tap(); await p.waitForTimeout(300);
    const plot = root.locator('[role="img"]').first();
    await plot.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 60)); await p.waitForTimeout(300);
    const box = await plot.boundingBox(), card = root.getByRole("status", { name: "Selected model" });
    let found = false;
    for (let gy = 0.2; gy <= 0.8 && !found; gy += 0.1) for (let gx = 0.3; gx <= 0.95 && !found; gx += 0.05) { await p.touchscreen.tap(box.x + box.width * gx, box.y + box.height * gy); await p.waitForTimeout(100); found = !!(await card.count()); }
    assert.ok(found, "card opens");
    await shot("student-card");
    inView(await card.evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }), vw, vh, "card");
  });
  await ctx.close();
}
await b.close();
if (fails.length) { console.log(`\n${fails.length} failed`); process.exit(1); }
console.log("mobile tooltips ok");
