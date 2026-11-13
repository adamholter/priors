/**
 * Runs on the Linux box, never on the Mac: `radar.ts` copies it to `adams-linux:agent-x/`, runs it there and deletes it.
 * Reads the recent posts on each handle's profile through the agent-owned, signed-in Chrome at localhost:9333, in one new tab
 * of its own that it always closes. Profiles are virtualized, so articles are collected while scrolling. Prints one JSON line.
 * Usage: node x-collect.mjs <scrolls> <handle> [handle...]
 */
import { chromium } from "playwright-core";

const [scrollsArg, ...handles] = process.argv.slice(2);
const scrolls = Number(scrollsArg) || 3;

/** Every article on the page now, read in the browser. Links keep the t.co href and the text X shows for it. */
const readArticles = () => [...document.querySelectorAll("article")].map((a) => {
  const time = a.querySelector("time");
  const status = time?.closest("a")?.getAttribute("href") ?? "";
  const text = [...a.querySelectorAll('[data-testid="tweetText"]')].map((t) => t.innerText).join("\n\n");
  const links = [...a.querySelectorAll('a[href^="https://t.co/"]')].map((l) => ({ href: l.href, text: (l.innerText || l.getAttribute("aria-label") || "").trim() }));
  const social = a.querySelector('[data-testid="socialContext"]')?.innerText ?? "";
  return { status, time: time?.getAttribute("datetime") ?? "", text, links, social, images: a.querySelectorAll('[data-testid="tweetPhoto"]').length };
});

const browser = await chromium.connectOverCDP("http://localhost:9333");
const page = await browser.contexts()[0].newPage();
const out = { profiles: [], errors: [] };
try {
  for (const handle of handles) {
    const seen = new Map();
    try {
      await page.goto(`https://x.com/${handle}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForSelector("article", { timeout: 15000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i <= scrolls; i++) {
        for (const a of await page.evaluate(readArticles)) if (a.status && !seen.has(a.status)) seen.set(a.status, a);
        if (i < scrolls) { await page.mouse.wheel(0, 2500); await page.waitForTimeout(1500); }
      }
    } catch (e) {
      // An empty, moved or missing account never shows an article: say which, so the account list can be fixed.
      const body = await page.evaluate(() => document.body.innerText).catch(() => "");
      const why = body.match(/Moved to @\w+|This account doesn’t exist|This account doesn't exist|\b0 posts\b/)?.[0];
      out.errors.push(`${handle}: ${why ?? String(e?.message ?? e).split("\n")[0]}`);
    }
    out.profiles.push({ handle, posts: [...seen.values()] });
    await page.waitForTimeout(1000);
  }
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
}
console.log(JSON.stringify(out));
