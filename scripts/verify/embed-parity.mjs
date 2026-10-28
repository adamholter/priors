/**
 * Embed parity benchmark: a copied chart link must unfurl as the PNG exported from that same chart.
 *   BASE=http://localhost:48798 N=24 SEED=1 node scripts/verify/embed-parity.mjs
 *
 * Each sample opens a random page and scatter chart in a random site scheme, applies random chart settings
 * (scale, All models, a model hidden through the context menu or the model picker, a highlighted mark), then runs one flow:
 *   toolbar: "Copy link to <chart>" and the toolbar PNG
 *   editor:  the screenshot editor with a random ratio, theme, title and toggles, its "Copy link" and its PNG
 * It fetches the copied link as Twitterbot, reads og:image, fetches that image from BASE and scores it against the PNG:
 *   aspect  |ln(aspect_export / aspect_embed)|, about the relative aspect difference
 *   gray    mean abs grayscale difference of 64 px tall thumbnails over their overlap (0 same, 1 opposite)
 *   bg      mean RGB difference of the two backgrounds (border median), 0..1: theme match
 *   corr    Pearson correlation of the thumbnails over the overlap (1 same structure)
 *   ink     layout distance: both stretched to 128x64, blurred, ink = |gray - background|, sum|a-b| / sum max(a,b)
 *           (0 same, 1 disjoint). Calibration on the first runs: same chart with a different frame 0.37-0.51,
 *           a different chart 0.66-0.84. Gray alone barely moves (charts are mostly background), so ink gates too.
 * Gross failures: no og:image, a non-200 image, or the generic card (image address without `c=`).
 * Artifacts for failures: /tmp/embed-parity/<n>-{export,embed}.png; full report: /tmp/embed-parity/report.json.
 * Env: BASE, N (24), SEED (random), OUT (/tmp/embed-parity), ONLY=toolbar|editor, HEADED=1, KEEP=1 (save artifacts for passes too).
 * Thresholds: AR_MAX (0.03), GRAY_MAX (0.12), BG_MAX (0.06), INK_MAX (0.30).
 */
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE ?? "http://localhost:48798").replace(/\/$/, "");
const N = Number(process.env.N ?? 24);
const SEED = Number(process.env.SEED ?? Math.floor(Math.random() * 1e9));
const OUT = process.env.OUT ?? "/tmp/embed-parity";
const ONLY = process.env.ONLY;
const AR_MAX = Number(process.env.AR_MAX ?? 0.03), GRAY_MAX = Number(process.env.GRAY_MAX ?? 0.12), BG_MAX = Number(process.env.BG_MAX ?? 0.06), INK_MAX = Number(process.env.INK_MAX ?? 0.3);
const BOT_UA = "Twitterbot/1.0";

// Seeded PRNG (mulberry32) so a SEED reproduces the same sample plan.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = rng(SEED);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const chance = (p) => rand() < p;

const PAGES = [
  { path: "/builder", w: 3 },
  { path: `/builder?i=${encodeURIComponent("Gear|aa-omniscience:50,aa-gdp-pdf:50")}`, w: 1 },
  { path: `/builder?i=${encodeURIComponent("Code|frontiercode-2.0-main:60,deepswe-1.1:40")}`, w: 1 },
  { path: "/benchmarks/frontiercode-2.0-main", w: 2 },
  { path: "/benchmarks/hearingbench", w: 2, explore: true },
  { path: "/benchmarks/deepswe-1.1", w: 2 },
  // arena-text has no scatter (no cost data, no measures), so it has nothing to export or link here.
];
const pickPage = () => { const total = PAGES.reduce((s, p) => s + p.w, 0); let r = rand() * total; for (const p of PAGES) { r -= p.w; if (r < 0) return p; } return PAGES[0]; };
const RATIOS = ["free", "16:9", "3:2", "4:3", "1:1", "4:5", "9:16"];
const TITLES = ["Who wins on cost", "Frontier check", "Cheap and good", "Score vs spend, October"];

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function retry(fn, tries = 4, wait = 4000) {
  let last;
  for (let i = 0; i < tries; i++) { try { return await fn(i); } catch (e) { last = e; await sleep(wait); } }
  throw last;
}

// ---------- image scoring ----------
async function thumb(buf) {
  const meta = await sharp(buf).metadata();
  const w = Math.max(1, Math.round((meta.width / meta.height) * 64));
  const { data, info } = await sharp(buf).flatten({ background: "#ffffff" }).resize(w, 64, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, data, width: meta.width, height: meta.height };
}
function borderBg(t) {
  const px = [];
  for (let x = 0; x < t.w; x++) for (const y of [0, 1, t.h - 2, t.h - 1]) px.push(x + y * t.w);
  for (let y = 0; y < t.h; y++) for (const x of [0, 1, t.w - 2, t.w - 1]) px.push(x + y * t.w);
  const med = (c) => { const v = px.map((i) => t.data[i * 3 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
  return [med(0), med(1), med(2)];
}
async function compare(exportBuf, embedBuf) {
  const a = await thumb(exportBuf), b = await thumb(embedBuf);
  const arA = a.width / a.height, arB = b.width / b.height;
  const w = Math.min(a.w, b.w);
  let sum = 0, n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < w; x++) {
    const ia = (x + y * a.w) * 3, ib = (x + y * b.w) * 3;
    const ga = 0.299 * a.data[ia] + 0.587 * a.data[ia + 1] + 0.114 * a.data[ia + 2];
    const gb = 0.299 * b.data[ib] + 0.587 * b.data[ib + 1] + 0.114 * b.data[ib + 2];
    sum += Math.abs(ga - gb) / 255; n++;
    sa += ga; sb += gb; saa += ga * ga; sbb += gb * gb; sab += ga * gb;
  }
  const cov = sab / n - (sa / n) * (sb / n), va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  const bgA = borderBg(a), bgB = borderBg(b);
  return {
    exportSize: `${a.width}x${a.height}`, embedSize: `${b.width}x${b.height}`,
    aspect: Math.abs(Math.log(arA / arB)), gray: sum / n,
    corr: va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0,
    bg: (Math.abs(bgA[0] - bgB[0]) + Math.abs(bgA[1] - bgB[1]) + Math.abs(bgA[2] - bgB[2])) / 765,
    bgExport: hex(bgA), bgEmbed: hex(bgB), ink: await inkDistance(exportBuf, embedBuf),
  };
}
async function inkMap(buf) {
  const { data } = await sharp(buf).flatten({ background: "#ffffff" }).resize(128, 64, { fit: "fill" }).blur(2.5).grayscale().raw().toBuffer({ resolveWithObject: true });
  const edge = [];
  for (let x = 0; x < 128; x++) edge.push(data[x], data[x + 63 * 128]);
  for (let y = 0; y < 64; y++) edge.push(data[y * 128], data[y * 128 + 127]);
  edge.sort((a, b) => a - b);
  const bg = edge[edge.length >> 1];
  return Float64Array.from(data, (v) => Math.abs(v - bg) / 255);
}
async function inkDistance(a, b) {
  const A = await inkMap(a), B = await inkMap(b);
  let num = 0, den = 0;
  for (let i = 0; i < A.length; i++) { num += Math.abs(A[i] - B[i]); den += Math.max(A[i], B[i]); }
  return den ? num / den : 0;
}
const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");

// ---------- the unfurl, as a crawler sees it ----------
const unescapeHtml = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
async function unfurl(link) {
  const local = new URL(link); const target = `${BASE}${local.pathname}${local.search}`;
  const res = await retry(async () => { const r = await fetch(target, { headers: { "user-agent": BOT_UA }, redirect: "follow" }); if (r.status >= 500) throw new Error(`page ${r.status}`); return r; }, 3, 3000);
  const html = await res.text();
  const tag = html.match(/<meta[^>]+property="og:image"[^>]*>/)?.[0];
  const og = tag?.match(/content="([^"]*)"/)?.[1];
  const title = unescapeHtml(html.match(/<meta[^>]+property="og:title"[^>]*content="([^"]*)"/)?.[1] ?? "");
  if (!og) return { pageStatus: res.status, title, error: "og:image missing" };
  const raw = unescapeHtml(og); const u = new URL(raw, BASE); const img = `${BASE}${u.pathname}${u.search}`;
  const ir = await retry(async () => { const r = await fetch(img, { headers: { "user-agent": BOT_UA } }); if (r.status >= 500) throw new Error(`image ${r.status}`); return r; }, 3, 4000).catch((e) => ({ status: 0, error: e.message }));
  if (!ir.ok) return { pageStatus: res.status, title, image: raw, imageStatus: ir.status, error: `image ${ir.status || ir.error}` };
  const buf = Buffer.from(await ir.arrayBuffer());
  return { pageStatus: res.status, title, image: raw, imageStatus: ir.status, buf, contentType: ir.headers.get("content-type") };
}
/** Params of the copied link that the image address no longer carries. */
function droppedParams(link, image) {
  const l = new URL(link), i = new URL(image, BASE);
  const ignore = new Set(["d", "date"]);
  return [...new Set([...l.searchParams.keys()])].filter((k) => !ignore.has(k) && !i.searchParams.has(k));
}

// ---------- driving the page like a user ----------
async function waitCharts(page) {
  await retry(async (i) => {
    if (i) await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".export-edit").first().waitFor({ state: "attached", timeout: 45000 });
  }, 4, 3000);
  await page.waitForTimeout(1500);
}
async function scatterAnchors(page) {
  return page.evaluate(() => [...document.querySelectorAll(".export-edit")].map((b) => b.closest("[id]")?.id).filter(Boolean));
}
/** Open a random collapsed gallery panel so its chart joins the pool. */
async function openRandomPanel(page, prefer) {
  const titles = await page.locator("details.gallery-panel:not([open]) summary .gallery-title").allTextContents();
  if (!titles.length) return null;
  const t = prefer && titles.includes(prefer) ? prefer : pick(titles);
  await page.locator("details.gallery-panel summary", { has: page.locator(".gallery-title", { hasText: t }) }).first().click();
  await page.waitForTimeout(1800);
  return t;
}
/** Centers of the plotted marks (small coloured SVG paths) inside a chart. */
async function markCenters(page, anchor) {
  return page.evaluate((id) => {
    const box = document.getElementById(id)?.querySelector('[role="img"]'); if (!box) return [];
    const out = [];
    for (const el of box.querySelectorAll("svg path")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.width > 22 || r.height < 4 || r.height > 22) continue;
      const fill = (el.getAttribute("fill") || "").toLowerCase();
      if (!fill || fill === "none" || fill === "transparent") continue;
      const m = fill.match(/^#([0-9a-f]{6})$/) || [];
      if (m[1]) { const n = parseInt(m[1], 16), rr = n >> 16, g = (n >> 8) & 255, b = n & 255; if (Math.max(rr, g, b) - Math.min(rr, g, b) < 40) continue; }
      out.push({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
    }
    return out;
  }, anchor);
}
async function setRange(locator, value) {
  await locator.evaluate((el, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, value);
}

async function chartSettings(page, wrap, applied) {
  const summary = wrap.locator('summary[aria-label$=" settings"]').first();
  if (!(await summary.count())) return;
  const open = async () => { await summary.click(); await page.waitForTimeout(400); };
  const close = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(400); };
  if (chance(0.6)) {
    await open();
    const settingsTab = page.getByRole("tab", { name: "Settings" });
    if (await settingsTab.count()) await settingsTab.first().click();
    const scale = chance(0.5) ? "Linear" : "Log";
    const scaleBtn = page.locator('[role="group"] button', { hasText: new RegExp(`^${scale}$`) }).first();
    if (await scaleBtn.isVisible().catch(() => false)) { await scaleBtn.click(); applied.scale = scale.toLowerCase(); }
    if (chance(0.4)) {
      const all = page.locator("label", { hasText: /^All models$/ }).locator('input[type="checkbox"]').first();
      if (await all.count()) { await all.evaluate((el) => el.click()); applied.allModels = await all.isChecked(); }
    }
    if (chance(0.35)) {
      const dens = page.locator('input[type="range"][aria-label$="label density"]').first();
      if (await dens.count()) { const v = pick([0, 30, 60, 100]); await setRange(dens, v); applied.density = v / 100; }
    }
    if (chance(0.3)) {
      const fr = page.locator("label", { hasText: /^Pareto frontier$/ }).locator('input[type="checkbox"]').first();
      if (await fr.count()) { await fr.evaluate((el) => el.click()); applied.frontier = await fr.isChecked(); }
    }
    await close();
  }
  if (chance(0.3)) {
    await open();
    const modelsTab = page.getByRole("tab", { name: "Models" });
    if (await modelsTab.count()) {
      await modelsTab.first().click(); await page.waitForTimeout(300);
      const boxes = page.locator('[role="tabpanel"] label input[type="checkbox"]:checked');
      const n = await boxes.count();
      if (n > 3) { const i = Math.floor(rand() * Math.min(n, 12)); const name = await boxes.nth(i).locator("xpath=..").innerText(); await boxes.nth(i).evaluate((el) => el.click()); applied.pickerHid = name.trim(); }
    }
    await close();
  }
}

async function contextHide(page, anchor, applied) {
  const marks = await markCenters(page, anchor);
  if (!marks.length) return;
  const m = pick(marks);
  await page.mouse.click(m.x, m.y, { button: "right" });
  const item = page.getByRole("menuitem", { name: chance(0.5) ? "Remove model" : "Remove", exact: true });
  if (await item.first().isVisible({ timeout: 1500 }).catch(() => false)) { await item.first().click(); applied.contextRemoved = (applied.contextRemoved ?? 0) + 1; await page.waitForTimeout(600); }
  else await page.keyboard.press("Escape");
}

async function highlightMark(page, anchor, applied) {
  const marks = await markCenters(page, anchor);
  for (let t = 0; t < 4 && marks.length; t++) {
    const m = marks.splice(Math.floor(rand() * marks.length), 1)[0];
    await page.mouse.click(m.x, m.y);
    await page.waitForTimeout(500);
    if (await page.locator('[role="status"][aria-label="Selected model"]').first().isVisible().catch(() => false)) { applied.highlighted = (applied.highlighted ?? 0) + 1; return; }
  }
}

async function readClipboard(page) { return page.evaluate(() => navigator.clipboard.readText()).catch(() => ""); }

async function download(page, button) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30000 }), button.click()]);
  const file = await dl.path();
  return fs.readFileSync(file);
}

async function runEditor(page, wrap, name, applied) {
  // The brush shows on hover of the PNG split button, as for a person.
  await wrap.locator(".export-split").first().hover();
  await wrap.locator(".export-edit").first().click();
  const dialog = page.locator("dialog.xe[open]");
  await dialog.waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const xe = {};
  if (chance(0.75)) { const r = pick(RATIOS); await dialog.getByRole("group", { name: "Aspect ratio" }).getByRole("button", { name: r === "free" ? "Free" : r, exact: true }).click(); xe.ratio = r; }
  if (chance(0.3)) { const w = pick([640, 900, 1200, 1600]); await dialog.getByLabel("Width").fill(String(w)); xe.w = w; }
  if (chance(0.6)) {
    const sel = dialog.getByLabel("Theme");
    const values = await sel.locator("option").evaluateAll((os) => os.map((o) => o.value));
    const v = pick(values); await sel.selectOption(v); xe.theme = v;
  }
  if (chance(0.4)) { const t = pick(TITLES); await dialog.getByLabel("Title").fill(t); xe.title = t; }
  for (const [label, key] of [["Pareto frontier", "frontier"], ["Effort lines", "links"], ["Guide lines", "guides"]]) {
    if (chance(0.3)) { const cb = dialog.locator("label.xe-check", { hasText: label }).locator("input"); await cb.click(); xe[key] = await cb.isChecked(); }
  }
  if (chance(0.3)) { const s = dialog.getByLabel("Scale"); if (await s.count()) { const v = pick(["log", "linear"]); await s.selectOption(v); xe.scale = v; } }
  const ranges = dialog.locator('label.xe-field input[type="range"]');
  if (chance(0.35)) { const v = pick([0, 0.3, 0.6, 1]); await setRange(ranges.nth(0), v); xe.density = v; }
  if (chance(0.35)) { const v = pick([75, 125, 175]); await setRange(ranges.nth(1), v); xe.labelScale = v / 100; }
  applied.xe = xe;
  await page.waitForTimeout(1500);
  await dialog.getByRole("button", { name: /^(Copy link|Link copied)$/ }).click();
  await page.waitForTimeout(400);
  let link = await readClipboard(page);
  if (!link) link = page.url();
  const png = await download(page, dialog.getByRole("button", { name: `Download ${name} as PNG` }));
  return { link, png };
}

async function runToolbar(page, wrap, name) {
  await wrap.getByRole("button", { name: `Copy link to ${name}`, exact: true }).click();
  await page.waitForTimeout(400);
  let link = await readClipboard(page);
  if (!link) link = page.url();
  const png = await download(page, wrap.getByRole("button", { name: `Download ${name} as PNG`, exact: true }));
  return { link, png };
}

function summarize(applied) {
  const parts = [applied.scheme];
  if (applied.panel) parts.push(`panel=${applied.panel}`);
  if (applied.measure) parts.push(`measure=${applied.measure}`);
  if (applied.scale) parts.push(applied.scale);
  if (applied.allModels != null) parts.push(`allModels=${+applied.allModels}`);
  if (applied.density != null) parts.push(`dens=${applied.density}`);
  if (applied.frontier != null) parts.push(`fr=${+applied.frontier}`);
  if (applied.pickerHid) parts.push(`hid:${applied.pickerHid.slice(0, 18)}`);
  if (applied.contextRemoved) parts.push(`ctxRm=${applied.contextRemoved}`);
  if (applied.highlighted) parts.push(`hl=${applied.highlighted}`);
  if (applied.xe) parts.push(`xe{${Object.entries(applied.xe).map(([k, v]) => `${k}=${typeof v === "boolean" ? +v : v}`).join(",")}}`);
  return parts.join(" ");
}

// ---------- main ----------
const browser = await chromium.launch({ headless: !process.env.HEADED });
const results = [];
console.log(`embed-parity BASE=${BASE} N=${N} SEED=${SEED} thresholds aspect<${AR_MAX} gray<${GRAY_MAX} bg<${BG_MAX} ink<${INK_MAX}`);
try {
  for (let n = 0; n < N; n++) {
    const pg = pickPage();
    const flow = ONLY ?? (chance(0.5) ? "toolbar" : "editor");
    const scheme = chance(0.5) ? "dark" : "light";
    const applied = { scheme };
    const rec = { n, page: pg.path, flow, applied };
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: scheme, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
    const page = await ctx.newPage();
    try {
      await retry(() => page.goto(`${BASE}${pg.path}`, { waitUntil: "domcontentloaded", timeout: 90000 }), 3, 5000);
      await waitCharts(page);
      if (pg.explore && chance(0.6)) {
        const t = await openRandomPanel(page, "Score vs any published measure");
        applied.panel = t;
        const measure = page.locator('select[aria-label="Measure"]');
        if (t === "Score vs any published measure" && await measure.count()) {
          const opts = await measure.locator("option").evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
          const [v, label] = pick(opts); await measure.selectOption(v); applied.measure = label; await page.waitForTimeout(1500);
        }
      } else if (chance(0.35)) applied.panel = await openRandomPanel(page) ?? undefined;
      const anchors = await scatterAnchors(page);
      // Prefer the chart in the panel just opened, when it is a scatter.
      const inPanel = applied.panel ? await page.evaluate((t) => [...document.querySelectorAll("details.gallery-panel[open]")].filter((d) => d.querySelector(".gallery-title")?.textContent === t).flatMap((d) => [...d.querySelectorAll(".export-edit")].map((b) => b.closest("[id]")?.id)).filter(Boolean), applied.panel) : [];
      if (!anchors.length) throw new Error("no scatter chart on the page");
      const anchor = inPanel.length && chance(0.8) ? pick(inPanel) : pick(anchors);
      rec.chart = anchor;
      const wrap = page.locator(`[id="${anchor}"]`);
      await wrap.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      const name = (await wrap.locator('button[aria-label^="Copy link to "]').first().getAttribute("aria-label")).replace(/^Copy link to /, "");
      rec.name = name;
      await chartSettings(page, wrap, applied);
      if (chance(0.3)) await contextHide(page, anchor, applied);
      if (chance(0.4)) await highlightMark(page, anchor, applied);
      await page.waitForTimeout(800);
      const { link, png } = flow === "editor" ? await runEditor(page, wrap, name, applied) : await runToolbar(page, wrap, name);
      rec.link = link;
      const u = await unfurl(link);
      Object.assign(rec, { image: u.image, imageStatus: u.imageStatus, ogTitle: u.title, error: u.error });
      if (u.image) {
        rec.dropped = droppedParams(link, u.image);
        const iu = new URL(u.image, BASE);
        rec.generic = !iu.searchParams.has("c");
      }
      if (u.buf) Object.assign(rec, await compare(png, u.buf));
      const failReasons = [];
      if (rec.error) failReasons.push(rec.error);
      if (rec.generic) failReasons.push("generic card");
      if (rec.aspect != null && rec.aspect >= AR_MAX) failReasons.push("aspect");
      if (rec.gray != null && rec.gray >= GRAY_MAX) failReasons.push("pixels");
      if (rec.bg != null && rec.bg >= BG_MAX) failReasons.push("theme");
      if (rec.ink != null && rec.ink >= INK_MAX) failReasons.push("layout");
      rec.pass = !failReasons.length;
      rec.why = failReasons;
      if (!rec.pass || process.env.KEEP) {
        fs.writeFileSync(path.join(OUT, `${n}-export.png`), png);
        if (u.buf) fs.writeFileSync(path.join(OUT, `${n}-embed.png`), u.buf);
      }
    } catch (e) {
      rec.pass = false; rec.why = ["harness: " + String(e.message).split("\n")[0].slice(0, 140)]; rec.harnessError = true;
      rec.harnessStack = String(e.stack).split("\n").slice(0, 6).join(" | ");
      await page.screenshot({ path: path.join(OUT, `${n}-harness.png`) }).catch(() => {});
    } finally { await ctx.close(); }
    rec.summary = summarize(applied);
    results.push(rec);
    const f = (v, d = 3) => v == null ? "  -  " : v.toFixed(d);
    console.log(`${String(n).padStart(3)} ${rec.pass ? "PASS" : "FAIL"} ${rec.flow.padEnd(7)} ${rec.page.slice(0, 40).padEnd(40)} ${String(rec.chart ?? "?").padEnd(20)} ar=${f(rec.aspect)} gray=${f(rec.gray)} bg=${f(rec.bg)} ink=${f(rec.ink, 2)} corr=${f(rec.corr, 2)} ${rec.exportSize ?? ""}->${rec.embedSize ?? ""} | ${rec.summary}${rec.why.length ? ` | ${rec.why.join(", ")}` : ""}${rec.dropped?.length ? ` | dropped: ${rec.dropped.join(",")}` : ""}`);
  }
} finally { await browser.close(); }

const scored = results.filter((r) => !r.harnessError);
const passed = scored.filter((r) => r.pass).length;
const mean = (k) => { const v = scored.filter((r) => r[k] != null).map((r) => r[k]); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN; };
// Badness: gross failures first, then the larger normalized miss.
const bad = (r) => (r.error || r.generic ? 10 : 0) + Math.max((r.aspect ?? 1) / AR_MAX, (r.gray ?? 1) / GRAY_MAX, (r.bg ?? 1) / BG_MAX, (r.ink ?? 1) / INK_MAX);
const reasons = {};
for (const r of results) for (const w of r.why) reasons[w.startsWith("harness") ? "harness error" : w] = (reasons[w.startsWith("harness") ? "harness error" : w] ?? 0) + 1;
const byFlow = Object.fromEntries(["toolbar", "editor"].map((f) => { const s = scored.filter((r) => r.flow === f); return [f, `${s.filter((r) => r.pass).length}/${s.length}`]; }));
console.log(`\nSummary: pass ${passed}/${scored.length} (${scored.length ? Math.round(100 * passed / scored.length) : 0}%) toolbar ${byFlow.toolbar} editor ${byFlow.editor}; harness errors ${results.length - scored.length}`);
console.log(`Mean aspect ${mean("aspect").toFixed(3)} gray ${mean("gray").toFixed(3)} bg ${mean("bg").toFixed(3)} ink ${mean("ink").toFixed(2)} corr ${mean("corr").toFixed(2)}`);
console.log(`Failure reasons: ${Object.entries(reasons).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
console.log("Worst 5:");
for (const r of [...scored].sort((a, b) => bad(b) - bad(a)).slice(0, 5)) console.log(`  #${r.n} ${r.flow} ${r.chart} [${r.why.join(", ")}] ${r.link}\n      image: ${r.image ?? "-"}`);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, seed: SEED, n: N, thresholds: { AR_MAX, GRAY_MAX, BG_MAX, INK_MAX }, passRate: scored.length ? passed / scored.length : 0, mean: { aspect: mean("aspect"), gray: mean("gray"), bg: mean("bg"), ink: mean("ink"), corr: mean("corr") }, reasons, results }, null, 2));
console.log(`Report: ${path.join(OUT, "report.json")}`);
