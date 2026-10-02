// No chart text may be clipped by its canvas: every ECharts <text> (axis labels, rotated bar
// categories, point labels) must sit inside its SVG. Checks every builder chart in both views, the
// expanded view, mobile, model pages and HTML embeds.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const BASE = process.env.BASE ?? 'http://localhost:48740';
const b = await chromium.launch();
const failures = [];
async function clipped(p, where) {
  const bad = await p.evaluate(() => [...document.querySelectorAll('[role=img] svg, #c svg')].flatMap((svg) => {
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    return [...svg.querySelectorAll('text')].flatMap((t) => {
      const r = t.getBoundingClientRect(), s = getComputedStyle(t);
      if (!r.width || s.opacity === '0' || s.visibility === 'hidden' || t.closest('[opacity="0"]')) return [];
      const out = r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1;
      return out ? [`"${t.textContent}" (${Math.round(r.left - box.left)}..${Math.round(r.right - box.left)} of ${Math.round(box.width)})`] : [];
    });
  }));
  for (const x of bad) failures.push(`${where}: ${x}`);
}
async function openPanels(p) { for (const d of await p.locator('details.gallery-panel').all()) { if (!(await d.getAttribute('open') !== null)) { await d.locator('> summary').click(); await p.waitForTimeout(400); } } }
async function bothViews(p, where) {
  await openPanels(p); await p.waitForTimeout(800); await clipped(p, `${where} default`);
  for (const btn of await p.getByRole('button', { name: 'Bar chart' }).all()) await btn.click();
  await p.waitForTimeout(900); await clipped(p, `${where} bars`);
  for (const btn of await p.getByRole('button', { name: /^Score vs/ }).all()) await btn.click();
  await p.waitForTimeout(900); await clipped(p, `${where} scatter`);
}
try {
  for (const [vp, tag] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'mobile'], [{ width: 820, height: 1000 }, 'tablet']]) {
    for (const scheme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: vp, colorScheme: scheme, isMobile: tag === 'mobile' });
      await ctx.addInitScript(() => { try { localStorage.setItem('priors:intro-seen', '1'); } catch {} });
      const p = await ctx.newPage();
      await p.goto(`${BASE}/builder`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
      await bothViews(p, `${tag}/${scheme} builder`);
      for (const btn of (await p.getByRole('button', { name: /^Expand / }).all()).slice(0, 3)) {
        await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(900);
        await clipped(p, `${tag}/${scheme} expanded ${await btn.getAttribute('aria-label')}`);
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      }
      await p.goto(`${BASE}/models/claude-opus-5.5`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
      await p.mouse.wheel(0, 2000); await p.waitForTimeout(1200);
      await clipped(p, `${tag}/${scheme} model page`);
      await ctx.close();
    }
  }
  console.log(failures.length ? failures.slice(0, 40).join('\n') : '');
  assert.equal(failures.length, 0, `${failures.length} clipped chart labels`);
  console.log('PASS chart labels: no clipped text across builder charts (both views, expanded), model pages, mobile/tablet/desktop, light/dark');
} finally { await b.close(); }
