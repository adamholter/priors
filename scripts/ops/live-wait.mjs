#!/usr/bin/env node
/**
 * Last step of "add this benchmark": wait until it is live, then say how long it took. `npm run live:wait -- <benchmarkId>
 * [model ...]` follows the scrape log (~/priors/logs/scrape.log) until the run started after the last push finishes, then
 * polls https://mypriors.com/benchmarks/<id> until the page is up and names each model. Prints the time since
 * `npm run bench:find` started the timer. Gives up after 15 minutes.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [id, ...models] = args;
if (!id) { console.error("usage: npm run live:wait -- <benchmarkId> [model ...]"); process.exit(1); }
const LOG = path.join(homedir(), "priors/logs/scrape.log");
const TIMER = path.join(homedir(), ".cache", "priors-bench-timer");
const SITE = process.env.PRIORS_SITE ?? "https://mypriors.com";
const started = existsSync(TIMER) ? Number(readFileSync(TIMER, "utf8")) : undefined;
const since = (t = Date.now()) => started ? `${Math.floor((t - started) / 60000)}m ${Math.round(((t - started) % 60000) / 1000)}s` : "no timer";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const deadline = Date.now() + 15 * 60_000;

// 1. The scrape run that began after the push (or the timer) has published.
const startMs = started ?? Date.now() - 10 * 60_000;
let head = "";
try { head = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { encoding: "utf8" }).trim(); } catch { /* not in a checkout */ }
if (process.argv.includes("--any-run")) head = "";
// A rejected push (a failing pre-push check) means no scrape is coming: say so now, not after 15 minutes.
if (head) {
  let remote = "";
  try { remote = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], { encoding: "utf8" }).slice(0, 8); } catch { /* offline: wait anyway */ }
  if (remote && remote !== head) { console.log(`HEAD ${head} is not on origin/main (${remote}): the push did not land. Fix the pre-push failure and push again.`); process.exit(1); }
}
let published;
while (Date.now() < deadline) {
  const lines = existsSync(LOG) ? readFileSync(LOG, "utf8").split("\n").slice(-3000) : [];
  // The run the push started, else the first one since the timer (a scheduled run can finish before the push).
  let runStart = head ? lines.findLastIndex((l) => l.startsWith("== ") && l.includes(`after push of ${head}`)) : -1;
  if (runStart < 0 && !head) lines.forEach((l, i) => { const m = l.match(/^== (\S+) scrape (started|\d{4})/); if (m && Date.parse(m[1]) >= startMs - 5000 && runStart < 0) runStart = i; });
  if (runStart >= 0) {
    const run = lines.slice(runStart);
    const done = run.find((l) => /^== done /.test(l));
    const fail = run.find((l) => /FAILED|not published/.test(l) && l.includes(id.split("-")[0]));
    if (fail) console.log(`log: ${fail}`);
    if (done) {
      published = Date.parse(done.slice(8).trim());
      const pointer = run.find((l) => l.startsWith("data pointer set"));
      console.log(`scrape published ${new Date(published).toLocaleTimeString()} (${since(published)})${pointer ? `, ${pointer}` : ""}`);
      break;
    }
  }
  await sleep(3000);
}
if (!published) { console.log("no finished scrape run since the timer; check ~/priors/logs/scrape.log"); process.exit(1); }

// 2. The page shows it.
const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
while (Date.now() < deadline) {
  const res = await fetch(`${SITE}/benchmarks/${encodeURIComponent(id)}`, { headers: { "cache-control": "no-cache" } }).catch(() => undefined);
  const html = res?.ok ? await res.text() : "";
  const missing = models.filter((m) => !flat(html).includes(flat(m)));
  if (res?.ok && !missing.length) {
    const count = html.match(/(\d+) models\./)?.[1];
    console.log(`LIVE ${SITE}/benchmarks/${id}${count ? ` (${count} models)` : ""}${started ? `: ${since()} since the timer` : ""}`);
    process.exit(0);
  }
  await sleep(5000);
}
console.log(`not live after 15 minutes: ${SITE}/benchmarks/${id}`);
process.exit(1);
