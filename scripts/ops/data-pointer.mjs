#!/usr/bin/env node
/**
 * Tells the live site which data-live commit to read, and clears the CDN's copies of data answers.
 *   node scripts/ops/data-pointer.mjs set <sha>   after a publish: point the site at the new commit
 *   node scripts/ops/data-pointer.mjs touch <sha> every run with no new data: confirm the pointer is still right
 *   node scripts/ops/data-pointer.mjs purge       drop CDN entries tagged `priors-data` (src/lib/data-cache-tag.ts)
 * The site trusts the pointer only while it was confirmed in the last 50 minutes (src/data/load.ts), so a job that stops
 * writing it degrades to reading the branch, never to frozen data.
 *
 * Auth: the Vercel CLI's login on this Mac. Its token is short-lived and refreshed by any CLI call, so this runs
 * `vercel whoami` first. Vercel does not let that login mint a long-lived token. The token is never printed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const TEAM = process.env.PRIORS_VERCEL_TEAM ?? "team_RQXowcVI5O6rxM5W3e98am65";
const PROJECT = process.env.PRIORS_VERCEL_PROJECT ?? "prj_UCq5JtrC4t4aluiaZenVj7n56Ema";
const EDGE_CONFIG = process.env.PRIORS_EDGE_CONFIG_ID ?? "ecfg_hlbegrdvcaofj38p3swfsojrvwpw";
const TAG = "priors-data";

let cached;
function token() {
  if (cached) return cached;
  try { execFileSync("npx", ["--yes", "vercel", "whoami"], { stdio: "ignore", timeout: 30_000 }); } catch { /* use what is on disk */ }
  const file = process.platform === "darwin" ? path.join(os.homedir(), "Library/Application Support/com.vercel.cli/auth.json") : path.join(os.homedir(), ".local/share/com.vercel.cli/auth.json");
  return (cached = JSON.parse(readFileSync(file, "utf8")).token);
}

async function api(method, url, body) {
  const res = await fetch(`https://api.vercel.com${url}${url.includes("?") ? "&" : "?"}teamId=${TEAM}`, {
    method, headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${method} ${url.split("?")[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({}));
}

const [cmd, sha] = process.argv.slice(2);
const now = new Date().toISOString();
try {
  if (cmd === "set" || cmd === "touch") {
    if (!/^[0-9a-f]{40}$/.test(sha ?? "")) throw new Error("need a 40-character commit sha");
    let published = now;
    if (cmd === "touch") {
      // Keep the publish time of the commit the pointer already names.
      const items = await api("GET", `/v1/edge-config/${EDGE_CONFIG}/items`).catch(() => []);
      const cur = (Array.isArray(items) ? items : []).find((i) => i.key === "dataLive")?.value;
      if (cur?.sha === sha && cur.published) published = cur.published;
    }
    await api("PATCH", `/v1/edge-config/${EDGE_CONFIG}/items`, { items: [{ operation: "upsert", key: "dataLive", value: { sha, published, checked: now } }] });
    console.log(`data pointer ${cmd}: ${sha.slice(0, 8)}`);
  } else if (cmd === "purge") {
    await api("POST", `/v1/edge-cache/dangerously-delete-by-tags?projectIdOrName=${PROJECT}`, { tags: [TAG], target: "production" });
    console.log(`purged CDN tag ${TAG}`);
  } else {
    console.error("usage: data-pointer.mjs set <sha> | touch <sha> | purge");
    process.exit(2);
  }
} catch (e) {
  console.error(`data pointer ${cmd} failed: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}
