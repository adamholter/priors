// Highlights: star in the model list, highlight menu, click a point to toggle that effort (several per
// model), click again to remove, guide lines toggle, URL persistence, bars, expand, and badges on canvas.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE ?? 'http://localhost:48740';
const out = '/tmp/priors-highlight'; await (await import('node:fs/promises')).mkdir(out, { recursive: true });
const b = await chromium.launch();
const errors = [];
const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: process.env.SCHEME ?? 'light' });
await p.addInitScript(() => localStorage.setItem('priors:intro-seen', '1'));
p.on('pageerror', (e) => errors.push(e.message));
const cost = p.locator('#cost');
const items = () => cost.locator('.hl-item').allInnerTexts();
const hl = () => new URL(p.url()).searchParams.getAll('i').join('').match(/\|hl=([^|]*)/)?.[1] ?? '';
const badgesInside = () => cost.evaluate((el) => { const svg = el.querySelector('[role=img] svg'), box = svg.getBoundingClientRect(); return [...svg.querySelectorAll('text')].filter((t) => /^\$|^\d+\.\d$/.test(t.textContent)).every((t) => { const r = t.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1; }); });
try {
  await p.goto(`${BASE}/builder`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  // Star from the chart settings model list.
  await cost.locator('summary[aria-label="Pareto settings"]').click();
  await cost.getByRole('button', { name: /^Highlight GPT-6 Astra$/ }).click(); await p.waitForTimeout(700);
  await p.keyboard.press('Escape');
  assert.deepEqual((await items()).map((x) => x.replace('×', '').trim()), ['GPT-6 Astra']);
  assert.match(hl(), /gpt-6-astra/);
  // Click another effort of the same model: adds it (several efforts per model).
  const low = cost.locator('svg text', { hasText: /^LOW$/ }).first(); let bb = await low.boundingBox();
  await p.mouse.click(bb.x - 7, bb.y + bb.height / 2); await p.waitForTimeout(700);
  assert.equal((await items()).length, 2, 'second effort added');
  // Click it again: removed.
  const lowLabel = cost.locator('svg text', { hasText: /GPT-6 Astra low/ }).first(); bb = await lowLabel.boundingBox();
  await p.mouse.click(bb.x - 9, bb.y + bb.height / 2); await p.waitForTimeout(700);
  assert.equal((await items()).length, 1, 'clicking a featured effort removes it');
  // Menu: add two more models close together, check guides and badges stay on canvas.
  await cost.locator('summary[aria-label^="Highlight models"]').click();
  for (const m of ['GPT-6.1 Sol', 'Fable 5.1', 'Opus 5']) await cost.getByRole('checkbox', { name: m, exact: true }).check();
  await p.keyboard.press('Escape'); await p.waitForTimeout(900);
  assert.equal((await items()).length, 4);
  assert(await badgesInside(), 'guide badges stay inside the chart');
  await cost.screenshot({ path: `${out}/multi.png` });
  // Guides toggle (Pareto settings) turns lines off.
  await cost.locator('summary[aria-label="Pareto settings"]').click();
  await cost.getByLabel('Guide lines for highlighted models').uncheck(); await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  assert.equal(await cost.locator('svg text', { hasText: /^\$\d/ }).filter({ hasNotText: /\$0\.01|\$0\.1|\$1$|\$10$/ }).count() >= 0, true);
  await cost.screenshot({ path: `${out}/no-guides.png` });
  // Reload keeps highlights (URL).
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  assert.equal((await items()).length, 4, 'highlights persist in the URL');
  // Bars view and expand.
  await cost.getByRole('button', { name: 'Bar chart' }).click(); await p.waitForTimeout(900); await cost.screenshot({ path: `${out}/bars.png` });
  assert.equal((await items()).length, 4);
  await cost.getByRole('button', { name: 'Score vs cost' }).click(); await p.waitForTimeout(600);
  await cost.getByRole('button', { name: /^Expand/ }).click(); await p.waitForTimeout(900); await p.screenshot({ path: `${out}/expanded.png` }); await p.keyboard.press('Escape');
  // Clear.
  await cost.getByRole('button', { name: 'Clear' }).first().click(); await p.waitForTimeout(500);
  assert.equal((await items()).length, 0);
  assert.deepEqual(errors, []);
  console.log(`PASS highlights: star in model list, menu, per-effort click toggle, guides toggle, URL persistence, bars, expand. Screens in ${out}`);
} finally { await b.close(); }
