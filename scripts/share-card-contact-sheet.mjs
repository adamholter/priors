import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const out = '/tmp/priors-share-cards';
const entries = JSON.parse(await readFile(`${out}/results.json`, 'utf8'));
const cards = await Promise.all(entries.map(async (entry, i) => `<section><h2>${entry.name}</h2><img src="data:image/png;base64,${(await readFile(`${out}/design-${i+1}.png`)).toString('base64')}" /></section>`));
const browser = await chromium.launch({ headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
 await page.setContent(`<style>body{margin:0;padding:24px;background:#e8e8e4;font-family:Arial}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}h2{font-size:16px;font-weight:400;margin:0 0 8px}img{display:block;width:100%}</style><main>${cards.join('')}</main>`);
 await page.screenshot({ path: `${out}/all-designs.png`, fullPage: true });
} finally { await browser.close(); }
