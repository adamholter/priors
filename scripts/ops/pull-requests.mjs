#!/usr/bin/env node
/**
 * Pulls the requests visitors sent from /request (convex/requests.ts) into a JSON file.
 *   PRIORS_REQUESTS_TOKEN=... PRIORS_CONVEX_URL=https://<deployment>.convex.cloud node scripts/ops/pull-requests.mjs <out.json>
 * The token is the deployment's REQUESTS_TOKEN. The URL falls back to NEXT_PUBLIC_CONVEX_URL.
 * Writes every request, newest first, as a JSON array of { id, kind, text, url?, contact?, handle?, createdAt, status },
 * and prints one line: the total and how many were not in the file before this run. Any failure exits 1 with a
 * message on stderr and leaves the previous file as it was. The token is never printed.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PAGE = 1000;

/** The requests in `current` that `previous` did not hold, by id. */
export function newSince(previous, current) {
  const seen = new Set((previous ?? []).map((r) => r.id));
  return current.filter((r) => !seen.has(r.id));
}

/** The one line a run prints. `previous` is null on a first run. */
export function summary(previous, current) {
  const fresh = newSince(previous, current).length;
  return `${current.length} request${current.length === 1 ? "" : "s"}, ${fresh} new ${previous ? "since the previous file" : "(no previous file)"}`;
}

/** An error message with the token cut out, whatever put it there. */
export const scrub = (message, token) => (token ? String(message).split(token).join("[token]") : String(message));

/**
 * Every request, newest first. `page(before)` returns up to `size` requests older than `before` (all of them when
 * undefined). Pages overlap by a millisecond so two requests stored in the same one are never split, and ids dedupe.
 */
export async function pullAll(page, size = PAGE) {
  const all = [], ids = new Set();
  for (let before; ;) {
    const rows = await page(before);
    if (!Array.isArray(rows)) throw new Error("requests:list did not return a list");
    const added = rows.filter((r) => !ids.has(r.id));
    for (const r of added) { ids.add(r.id); all.push(r); }
    if (rows.length < size || !added.length) return all;
    before = rows[rows.length - 1].createdAt + 1;
  }
}

/** The previous run's list, or null when there is no file yet. A file that is not a JSON array is an error, never overwritten. */
export function readPrevious(file) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch (e) { if (e.code === "ENOENT") return null; throw new Error(`cannot read ${file}: ${e.message}`); }
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`${file} is not valid JSON. Move it aside and run again.`); }
  if (!Array.isArray(data)) throw new Error(`${file} is not a list of requests. Move it aside and run again.`);
  return data;
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const out = argv[0];
  const token = env.PRIORS_REQUESTS_TOKEN ?? "";
  const base = (env.PRIORS_CONVEX_URL || env.NEXT_PUBLIC_CONVEX_URL || "").replace(/\/+$/, "");
  try {
    if (!out) throw new Error("usage: pull-requests.mjs <out.json>");
    if (!token) throw new Error("PRIORS_REQUESTS_TOKEN is not set");
    if (!base) throw new Error("PRIORS_CONVEX_URL is not set (NEXT_PUBLIC_CONVEX_URL works too)");
    const file = resolve(out);
    const previous = readPrevious(file);
    const current = await pullAll(async (before) => {
      const res = await fetch(`${base}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "requests:list", args: { token, limit: PAGE, ...(before === undefined ? {} : { before }) }, format: "json" }), signal: AbortSignal.timeout(30_000) });
      const body = await res.json().catch(() => null);
      if (!body || body.status !== "success") throw new Error(body?.errorData === "forbidden" ? "the token was refused (wrong token, or REQUESTS_TOKEN is not set on that deployment)" : `requests:list failed: ${body?.errorMessage ?? `HTTP ${res.status}`}`);
      return body.value;
    });
    mkdirSync(dirname(file), { recursive: true });
    // Written whole or not at all: a reader never sees half a file.
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(current, null, 2)}\n`);
    renameSync(tmp, file);
    console.log(summary(previous, current));
    return 0;
  } catch (e) {
    console.error(`pull-requests: ${scrub(e instanceof Error ? e.message : e, token)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(await main());
