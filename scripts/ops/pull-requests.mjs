#!/usr/bin/env node
/**
 * Pulls the requests visitors sent from /request (convex/requests.ts) into a JSON file.
 *   PRIORS_REQUESTS_TOKEN=... PRIORS_CONVEX_URL=https://<deployment>.convex.cloud node scripts/ops/pull-requests.mjs <out.json>
 * The token is the deployment's REQUESTS_TOKEN. The URL falls back to NEXT_PUBLIC_CONVEX_URL.
 * Writes every request, newest first, as a JSON array of { id, kind, text, url?, contact?, context?, handle?, createdAt, status, files },
 * and prints one line: the total and how many were not in the file before this run. Files attached to a request (screenshots,
 * logs) are downloaded once into `files/<request id>/` beside the JSON, and each request lists them as { name, type, size, path }. Any failure exits 1 with a
 * message on stderr and leaves the previous file as it was. The token is never printed.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

/** A name that is safe to write inside one folder, whatever the server sent: no path, no control characters, never empty or a dot file. */
export const safeName = (name) => (String(name ?? "").split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").trim().replace(/^\.+/, "") || "file").slice(0, 140);

/**
 * Where each of a request's files goes, relative to the JSON: `files/<request id>/<name>`. Two files with one name get
 * a number, so neither overwrites the other.
 */
export function filePlan(request) {
  const used = new Set();
  return (request.files ?? []).map((f) => {
    let name = safeName(f.name);
    for (let n = 2; used.has(name.toLowerCase()); n++) { const base = safeName(f.name), dot = base.lastIndexOf("."); name = dot > 0 ? `${base.slice(0, dot)}-${n}${base.slice(dot)}` : `${base}-${n}`; }
    used.add(name.toLowerCase());
    return { name: f.name, type: f.type, size: f.size, url: f.url, path: join("files", safeName(request.id), name) };
  });
}

/**
 * Downloads the files not on disk yet and returns the request as it is written: its files without their links. A file
 * that cannot be fetched is listed with `missing: true` and tried again next run; it never fails the pull.
 */
export async function withFiles(request, dir, get = (url) => fetch(url, { signal: AbortSignal.timeout(120_000) })) {
  const files = [];
  for (const f of filePlan(request)) {
    const to = join(dir, f.path), entry = { name: f.name, type: f.type, size: f.size, path: f.path };
    if (!(existsSync(to) && statSync(to).size === f.size)) {
      try {
        if (!f.url) throw new Error("no link");
        const res = await get(f.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        mkdirSync(dirname(to), { recursive: true });
        const tmp = `${to}.${process.pid}.tmp`;
        writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
        renameSync(tmp, to);
      } catch { entry.missing = true; }
    }
    files.push(entry);
  }
  return { ...request, files };
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
    const pulled = await pullAll(async (before) => {
      const res = await fetch(`${base}/api/query`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: "requests:list", args: { token, limit: PAGE, ...(before === undefined ? {} : { before }) }, format: "json" }), signal: AbortSignal.timeout(30_000) });
      const body = await res.json().catch(() => null);
      if (!body || body.status !== "success") throw new Error(body?.errorData === "forbidden" ? "the token was refused (wrong token, or REQUESTS_TOKEN is not set on that deployment)" : `requests:list failed: ${body?.errorMessage ?? `HTTP ${res.status}`}`);
      return body.value;
    });
    mkdirSync(dirname(file), { recursive: true });
    const current = [];
    for (const r of pulled) current.push(await withFiles(r, dirname(file)));
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
