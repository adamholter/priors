// Dark mode: system default, toggle + persistence, charts and lab colors re-theme, no hydration errors.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE ?? 'http://localhost:48740';
const b = await chromium.launch();
const errors = [];
const theme = (p) => p.evaluate(() => document.documentElement.dataset.theme);
const axisText = (p) => p.locator('#cost svg text').first().evaluate((t) => t.getAttribute('fill'));
const firstBar = (p) => p.locator('.ranking-list .bar-fill').first().evaluate((e) => getComputedStyle(e).backgroundColor);
try {
  // System dark is honored before any choice.
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(`${p.url()}: ${e.message}`));
  await p.goto(`${BASE}/builder`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  assert.equal(await theme(p), 'dark');
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(20, 20, 19)');
  const darkAxis = await axisText(p), darkBar = await firstBar(p);
  // Toggle to light: page, chart text and lab bars all switch; the choice persists.
  await p.getByRole('button', { name: 'Switch to light mode' }).click(); await p.waitForTimeout(900);
  assert.equal(await theme(p), 'light');
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).backgroundColor), 'rgb(251, 251, 249)');
  assert.notEqual(await axisText(p), darkAxis, 'chart re-themes');
  assert.notEqual(await firstBar(p), darkBar, 'lab colors re-theme');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  assert.equal(await theme(p), 'light', 'explicit choice beats system dark');
  await p.getByRole('button', { name: 'Switch to dark mode' }).click(); await p.waitForTimeout(600);
  assert.equal(await p.evaluate(() => localStorage.getItem('priors:theme')), 'dark');
  // Routes hydrate cleanly in dark, including navigations between static pages.
  for (const r of ['/', '/skill', '/privacy', '/import', '/models/claude-opus-5.5', '/builder']) { await p.goto(BASE + r, { waitUntil: 'networkidle' }); await p.waitForTimeout(500); assert.equal(await theme(p), 'dark', r); }
  await ctx.close();
  // System light, no choice → light.
  const l = await b.newPage({ colorScheme: 'light' });
  await l.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  assert.equal(await theme(l), 'light');
  // Share cards render in both schemes (corner pixel = card background); the share dialog follows the site theme.
  const px = (url) => l.evaluate(async (u) => { const img = new Image(); img.src = u; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); return [...g.getImageData(4, 4, 1, 1).data.slice(0, 3)]; }, url);
  for (const d of ['board', 'qr', 'ranking', 'podium', 'split', 'scoreboard', 'staircase', 'constellation', 'columns', 'race', 'ledger', 'spotlight']) {
    assert.deepEqual(await px(`${BASE}/og?design=${d}&scheme=dark`), d === 'spotlight' ? [30, 39, 71] : [20, 20, 19], `${d} dark`);
    assert.deepEqual(await px(`${BASE}/og?design=${d}`), d === 'spotlight' ? [26, 26, 26] : [251, 251, 249], `${d} light`);
  }
  assert.deepEqual(errors, []);
  console.log('PASS dark mode: system default, toggle, persistence, chart + lab re-theme, clean hydration across routes, share cards in both schemes');
} finally { await b.close(); }
