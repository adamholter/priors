// Pairwise bracket onboarding: buttons, keys, swipes, undo, finish-with-index, review handoff, mobile.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.BASE ?? 'http://localhost:48740';
const out = '/tmp/priors-bracket-qa'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const pair = (page) => page.locator('.duel-card .duel-name').allInnerTexts();
const round = (page) => page.locator('.bracket-round').innerText();
try {
  // Desktop: keyboard + buttons + undo + click.
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('priors:intro-seen', '1'); sessionStorage.setItem('seeded', '1'); } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('.duel-card').first().waitFor();
  assert.equal((await round(page)).toLowerCase(), 'round of 16');
  assert.equal(await page.locator('.shape-list li').count(), 16);
  await page.screenshot({ path: `${out}/desktop-start.png` });
  const first = await pair(page);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(800);
  assert.notDeepEqual(await pair(page), first);
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await page.waitForTimeout(500);
  assert.deepEqual(await pair(page), first, 'undo returns the same matchup');
  await page.getByRole('button', { name: 'Right is better' }).click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Not sure' }).click(); await page.waitForTimeout(500);
  await page.locator('.duel-card[data-side="left"]').click(); await page.waitForTimeout(800);
  // Mouse swipe right
  const box = await page.locator('.duel').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
  await page.screenshot({ path: `${out}/desktop-lean.png` });
  assert.equal(await page.locator('.duel-card.leaning').getAttribute('data-side'), 'right');
  const rightName = await page.locator('.duel-card[data-side="right"] .duel-name').innerText();
  assert.equal(await page.locator('.duel-verdict strong').innerText(), rightName, 'verdict names the model being dragged toward');
  assert.match(await page.locator('.duel-card.leaning .duel-stamp').innerText(), /better/i);
  assert(await page.locator('.duel-choice.armed').innerText().then((t) => /Right is better/.test(t)), 'matching button highlights');
  await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(800);
  assert.equal(await page.locator('.bracket-meta span').nth(1).innerText(), 'CALL 05');
  // Reload restores progress
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(400);
  assert.equal(await page.locator('.bracket-meta span').nth(1).innerText(), 'CALL 05', 'progress persists');
  // Agree with whatever is left side for a while, then let the index finish.
  for (let i = 0; i < 8; i++) { await page.keyboard.press(i % 3 ? 'ArrowLeft' : 'ArrowRight'); await page.waitForTimeout(750); }
  await page.screenshot({ path: `${out}/desktop-mid.png` });
  await page.getByRole('button', { name: 'Let the index decide the rest' }).click();
  await page.getByRole('heading', { name: /Your top three/ }).waitFor();
  assert.match(await page.locator('.done-cap').first().innerText(), /12 CALLS/i);
  await page.screenshot({ path: `${out}/desktop-done.png` });
  const ranking = await page.locator('.shape-list li span').allInnerTexts();
  await page.getByRole('button', { name: 'See my full ranking' }).click();
  await page.getByRole('heading', { name: /Your ranking/ }).waitFor();
  const rows = await page.locator('.tactile-row .model-name').allInnerTexts();
  assert.equal(rows.length, 16);
  const visual = await page.locator('[data-model]').evaluateAll((es) => es.map((e) => [e.querySelector('.model-name').textContent, new DOMMatrix(getComputedStyle(e).transform).m42]).sort((a, b) => a[1] - b[1]).map((x) => x[0]));
  assert.deepEqual(visual, ranking, 'review list starts from the bracket result');
  await page.screenshot({ path: `${out}/desktop-review.png`, fullPage: true });
  await page.getByRole('button', { name: 'Back to the matchups' }).click();
  await page.getByRole('heading', { name: /Your top three/ }).waitFor();
  assert.deepEqual(errors, []);

  // Mobile: touch swipes.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await ctx.newPage(); const merr = []; m.on('pageerror', (e) => merr.push(e.message));
  await m.addInitScript(() => localStorage.setItem('priors:intro-seen', '1'));
  await m.goto(BASE, { waitUntil: 'networkidle' }); await m.locator('.duel-card').first().waitFor();
  await m.screenshot({ path: `${out}/mobile-start.png` });
  const actions = await m.locator('.duel-actions').boundingBox();
  assert(actions.y + actions.height <= 844, `buttons above the fold (${actions.y + actions.height})`);
  assert(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
  const swipe = async (dx, dy = 0) => {
    const b = await m.locator('.duel').boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const cdp = await ctx.newCDPSession(m);
    const pts = (px, py) => [{ x: px, y: py }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(x, y) });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(x + dx * i / 8, y + dy * i / 8) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await m.waitForTimeout(800);
  };
  {
    const b = await m.locator('.duel').boundingBox(); const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const cdp = await ctx.newCDPSession(m); const before = await pair(m);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 10 * i, y }] });
    await m.waitForTimeout(150);
    assert.equal(await m.locator('.duel-card.leaning').getAttribute('data-side'), 'left');
    assert.equal(await m.locator('.duel-verdict strong').innerText(), before[0], 'short drag left previews the left model as better');
    await m.screenshot({ path: `${out}/mobile-lean.png` });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(500);
    assert.deepEqual(await pair(m), before, 'releasing before the threshold cancels');
  }
  const before = await pair(m);
  await swipe(-150);
  assert.notDeepEqual(await pair(m), before, 'swipe left answers');
  await swipe(150); await m.getByRole('button', { name: 'Not sure' }).tap(); await m.waitForTimeout(800);
  assert.equal(await m.locator('.bracket-meta span').nth(1).innerText(), 'CALL 04');
  await m.screenshot({ path: `${out}/mobile-mid.png` });
  await m.getByRole('button', { name: 'Let the index decide the rest' }).click();
  await m.getByRole('heading', { name: /Your top three/ }).waitFor(); await m.waitForTimeout(700);
  await m.screenshot({ path: `${out}/mobile-done.png` });
  await m.getByRole('button', { name: 'See my full ranking' }).click(); await m.waitForTimeout(400);
  await m.screenshot({ path: `${out}/mobile-review.png`, fullPage: true });
  assert(await m.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(merr, []);
  console.log(`PASS bracket: keys, buttons, click, mouse swipe, undo, persistence, finish-with-index, review handoff (${rows.length} models), mobile touch swipes. Screens in ${out}`);
} finally { await browser.close(); }
