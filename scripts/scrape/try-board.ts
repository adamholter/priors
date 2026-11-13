/**
 * Dry run for a config-only board (`boards/configs.ts`). Nothing is written.
 *   npm run board:try -- <url>                         find reader candidates, show their rows and how each label normalizes, print a config
 *   npm run board:try -- <url> --reader table --label Model --value Score [--table 1]
 *   npm run board:try -- <url> --reader nextData --rows props.pageProps.rows --label name --value score [--effort e] [--ciHalf err]
 *   npm run board:try -- <url> --reader json --rows data --label model --value accuracy [--scale 100]
 *   npm run board:try -- <url> --reader ariaLabel [--match "^Accuracy"] [--after "products:.*?%\. "]
 *   npm run board:try -- --config owe-bench            run a config already in configs.ts
 * Flags: --browser (render the page in headless Chromium first), --all (every candidate, not the top 5),
 * --label-prefix "Claude " [--prefix-when "^(Fable|Opus)"], --skip <regex>, --details name=path,name=path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "../../src/data/types";
import { normalizeLabel } from "../../src/data/normalize";
import { catalogEntry } from "../../src/data/catalog";
import { closeBrowser, makeContext } from "./harness";
import { BOARDS } from "./boards/configs";
import { detectCandidates, jsonCandidates, jsonLinks, type Candidate } from "./boards/detect";
import { fixLabel, readBoard, type BoardConfig, type ReaderName } from "./boards/run";
import type { BoardRow } from "./boards/readers";

const READERS: ReaderName[] = ["ariaLabel", "nextData", "json", "table"];
const CLAUDE = { prefix: "Claude ", when: /^(Fable|Opus|Sonnet|Haiku)\b/ };

function parseArgs(argv: string[]) {
  const flags: Record<string, string | true> = {}, pos: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { pos.push(a); continue; }
    const k = a.slice(2), next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) flags[k] = true; else { flags[k] = next; i++; }
  }
  return { url: pos[0], flags };
}

/** Reader options from flags: everything that is not a CLI switch, with numbers, regexes and `details` typed. */
function readerOptions(flags: Record<string, string | true>): Record<string, unknown> {
  const skip = new Set(["reader", "browser", "all", "config", "label-prefix", "prefix-when", "skip", "scale"]), o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flags)) {
    if (skip.has(k) || v === true) continue;
    if (k === "table") o.table = /^\d+$/.test(v) ? Number(v) : v;
    else if (k === "match" || k === "after") o[k] = new RegExp(v);
    else if (k === "details") o.details = Object.fromEntries(v.split(",").map((kv) => kv.split("=").map((s) => s.trim()) as [string, string]));
    else o[k] = v;
  }
  return o;
}

let models: Set<string> | undefined, benchmarks: Snapshot["benchmarks"] = [];
function snapshotModels(): Set<string> {
  if (models) return models;
  try {
    const snap = JSON.parse(gunzipSync(readFileSync(path.resolve(__dirname, "../../data/snapshots/latest.json.gz"))).toString("utf8")) as Snapshot;
    models = new Set(snap.models.map((m) => m.id));
    benchmarks = snap.benchmarks;
  } catch { models = new Set(); console.log("(no data/snapshots/latest.json.gz: cannot say which models Priors already has)"); }
  return models;
}

/** Benchmarks Priors already reads from the same site, so a board is not added twice under a new id. */
function sameSite(url: string, id: string) {
  snapshotModels();
  const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const hits = benchmarks.filter((b) => b.id === id || host(b.url) === host(url));
  if (hits.length) console.log(`  Already in Priors from this site or under this id: ${hits.slice(0, 8).map((b) => `${b.id} (source ${b.sourceId})`).join(", ")}. Reuse its id instead of adding a duplicate.`);
}

type Fix = Pick<BoardConfig, "labelMap" | "labelPrefix" | "skip">;
function norm(label: string, effort: string | undefined, fix: Fix) {
  const shown = fixLabel(fix, label), n = normalizeLabel(shown, effort);
  if (!n.ok) return { shown, text: `UNKNOWN (cleaned "${n.cleaned}")`, known: false, inSnap: false };
  const inSnap = snapshotModels().has(n.modelId);
  return { shown, text: `${n.modelId}@${n.effort ?? "default"}${inSnap ? "" : "  (NEW: not in the current snapshot)"}`, known: true, inSnap };
}

function score(rows: BoardRow[], fix: Fix) {
  const kept = rows.filter((r) => !fix.skip?.test(r.modelLabel));
  const ns = kept.map((r) => norm(r.modelLabel, r.effort, fix));
  const dupes = kept.length - new Set(kept.map((r) => `${r.modelLabel}\u0000${r.effort ?? ""}`)).size;
  // Repeated labels mean several boards in one list (or one board's sub-scores): rank those below a clean board.
  return { kept, known: ns.filter((n) => n.known).length, inSnap: ns.filter((n) => n.inSnap).length, rank: ns.filter((n) => n.inSnap).length - dupes };
}

/** Prefix Anthropic's family when the page leaves it off and that is what keeps labels from normalizing. */
function suggestFix(rows: BoardRow[]): Fix {
  const bare = rows.filter((r) => CLAUDE.when.test(r.modelLabel) && !normalizeLabel(r.modelLabel, r.effort).ok);
  return bare.length ? { labelPrefix: CLAUDE } : {};
}

const fmt = (r: BoardRow) => `${r.value}${r.ci ? ` [${r.ci.map((x) => +x.toFixed(3)).join(", ")}]` : ""}${r.effort ? ` effort=${r.effort}` : ""}${r.costUsd !== undefined ? ` cost=$${r.costUsd}` : ""}`;

function show(rows: BoardRow[], fix: Fix, full: boolean) {
  const { kept, known, inSnap } = score(rows, fix);
  console.log(`  rows: ${kept.length}${kept.length !== rows.length ? ` (${rows.length - kept.length} skipped)` : ""}; labels that normalize: ${known}/${kept.length}, models already in Priors: ${inSnap}`);
  const labels = new Map<string, BoardRow>();
  kept.forEach((r) => labels.set(`${r.modelLabel}\u0000${r.effort ?? ""}`, r));
  const dupes = kept.length - labels.size;
  if (dupes) console.log(`  ${dupes} rows repeat a label and effort: the page may hold several boards in one list; narrow the selection`);
  kept.slice(0, 10).forEach((r, i) => { const n = norm(r.modelLabel, r.effort, fix); console.log(`  ${String(i + 1).padStart(2)}. ${n.shown.padEnd(34)} ${fmt(r).padEnd(30)} → ${n.text}`); });
  if (!full || kept.length <= 10) return;
  console.log("  every other label:");
  for (const r of kept.slice(10)) { const n = norm(r.modelLabel, r.effort, fix); console.log(`      ${n.shown.padEnd(34)} → ${n.text}`); }
}

/** Config fields as TypeScript, regexes as literals. */
function ts(v: unknown): string {
  if (v instanceof RegExp) return v.toString();
  if (Array.isArray(v)) return `[${v.map(ts).join(", ")}]`;
  if (v && typeof v === "object") return `{ ${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${ts(x)}`).join(", ")} }`;
  return JSON.stringify(v);
}

function pageTitle(html: string): string {
  const t = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? "";
  return t.replace(/\s+[|·–-]\s+.*$/, "").replace(/^(introducing|announcing)\s+/i, "").replace(/&amp;/g, "&").trim();
}

function printConfig(c: Candidate, url: string, fetchUrl: string | undefined, html: string, fix: Fix, browser: boolean) {
  // An endpoint is fetched, but the benchmark links a page people can read: the site's home until someone picks a better one.
  if (c.reader === "json" && !fetchUrl) { fetchUrl = url; url = new URL(url).origin; }
  const name = pageTitle(html) || new URL(url).hostname.replace(/^www\./, "");
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "new-board";
  const vals = c.rows.map((r) => r.value), max = Math.max(...vals), min = Math.min(...vals);
  const fraction = max <= 1 && min >= 0, percent = fraction || (max <= 100 && min >= 0);
  const unit = percent ? "percent" : max > 400 ? "elo" : "score";
  const kept = score(c.rows, fix).kept.length;
  const lines = [
    `id: ${ts(id)}, name: ${ts(name)}, shortName: ${ts(name)}, url: ${ts(url)},${fetchUrl ? ` fetch: ${ts(fetchUrl)},` : ""}${browser ? " browser: true," : ""}`,
    `reader: ${ts(c.reader)}, ${ts(c.options).slice(2, -2)},`,
    `unit: ${ts(unit)}, higherIsBetter: true, category: "other", ${percent ? `normalization: { kind: "linear", min: 0, max: 100 }, ` : ""}minRows: ${Math.max(3, Math.floor(kept * 0.6))},${fraction ? " scale: 100," : ""}`,
    `description: "TODO: what the model is asked to do, then how the number is scored.",`,
    ...(fix.labelPrefix ? [`labelPrefix: ${ts(fix.labelPrefix)},`] : []),
  ];
  console.log(`\n=== Config for scripts/scrape/boards/configs.ts (check id, category, higherIsBetter, unit and description) ===\n  {\n${lines.map((l) => `    ${l}`).join("\n")}\n  },`);
  if (c.rows.some((r) => r.costUsd !== undefined)) console.log("  Cost per task was read from the page. Keep it only if it is measured run cost, never token price.");
  sameSite(url, id);
  const unknown = [...new Set(score(c.rows, fix).kept.filter((r) => !norm(r.modelLabel, r.effort, fix).known).map((r) => r.modelLabel))];
  if (unknown.length) {
    console.log(`  ${unknown.length} labels match no model, and the build drops them: ${unknown.slice(0, 12).join(" | ")}${unknown.length > 12 ? " …" : ""}`);
    console.log(`  A real model among them needs an alias or family in src/data/normalize.ts; anything else (products, baselines) can be skipped: skip: /^(${unknown.slice(0, 12).map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|")})$/,`);
  }
  printCatalogStub(id);
}

function printCatalogStub(id: string) {
  if (catalogEntry({ id } as never)) { console.log(`\nCatalog: "${id}" already has an entry in src/data/catalog/.`); return; }
  console.log(`\n=== Catalog entry, required (src/data/catalog/direct.ts; rules in docs/data.md "Descriptions and categories") ===`);
  console.log(`  ${JSON.stringify(id)}: { c: ["other"], d: "TODO: what the model is asked to do, in plain words, then how the number is scored, then any caveat. From <publisher>." },`);
  console.log("  Then run: npx vitest run scripts/scrape src/data, and npm run scrape -- --only <id> for a real snapshot row.");
}

async function main() {
  const { url: argUrl, flags } = parseArgs(process.argv.slice(2));
  const config = typeof flags.config === "string" ? BOARDS.find((b) => b.id === flags.config) : undefined;
  if (flags.config && !config) throw new Error(`no config "${flags.config}" in boards/configs.ts (have: ${BOARDS.map((b) => b.id).join(", ")})`);
  const url = argUrl ?? config?.url;
  if (!url) { console.log("usage: npm run board:try -- <url> [--reader ariaLabel|nextData|json|table ...options] [--browser] [--all] | --config <id>"); process.exit(1); }
  const browser = flags.browser === true || !!config?.browser, ctx = makeContext("board:try", () => {});
  const fetchUrl = config ? config.fetch ?? config.url : url;
  const body = browser ? await ctx.withPage(fetchUrl, (p) => p.content()) : await ctx.fetchText(fetchUrl);
  console.log(`fetched ${fetchUrl}: ${(body.length / 1024).toFixed(0)} KB${browser ? " (rendered)" : ""}`);

  if (config) {
    console.log(`\n=== config ${config.id} (${config.reader}) ===`);
    show(readBoard(config as never, body).map((r) => ({ ...r, value: r.value * (config.scale ?? 1) })), config, true);
    printCatalogStub(config.id);
    return;
  }

  const fix: Fix = {
    ...(typeof flags["label-prefix"] === "string" ? { labelPrefix: { prefix: flags["label-prefix"], ...(typeof flags["prefix-when"] === "string" ? { when: new RegExp(flags["prefix-when"]) } : {}) } } : {}),
    ...(typeof flags.skip === "string" ? { skip: new RegExp(flags.skip) } : {}),
  };
  const scale = typeof flags.scale === "string" ? Number(flags.scale) : 1;

  if (typeof flags.reader === "string") {
    if (!READERS.includes(flags.reader as ReaderName)) throw new Error(`--reader must be one of ${READERS.join(", ")}`);
    const options = readerOptions(flags);
    const rows = readBoard({ reader: flags.reader as ReaderName, ...options }, body).map((r) => ({ ...r, value: r.value * scale }));
    const f = fix.labelPrefix ? fix : { ...fix, ...suggestFix(rows) };
    console.log(`\n=== ${flags.reader} ${ts(options)} ===`);
    show(rows, f, true);
    if (rows.length) printConfig({ reader: flags.reader as ReaderName, options: { ...options, ...(scale !== 1 ? { scale } : {}) }, rows, why: "" }, url, undefined, body, f, browser);
    return;
  }

  // No reader given: every candidate on the page, then the JSON files it links.
  const found: { c: Candidate; fetchUrl?: string }[] = detectCandidates(body).map((c) => ({ c }));
  for (const link of jsonLinks(body, url)) {
    try {
      const data = await ctx.fetchJson(link);
      jsonCandidates(data, "json").forEach((c) => found.push({ c: { ...c, why: `${c.why} in ${link}` }, fetchUrl: link }));
    } catch { console.log(`(could not read linked JSON ${link})`); }
  }
  if (!found.length) {
    console.log(`\nNo candidates.${browser ? "" : " The board may be drawn in the browser: try again with --browser."} Otherwise it needs a hand-written source (copy sources/_template.ts).`);
    return;
  }
  const ranked = found.map((f) => {
    const fx = { ...fix, ...(fix.labelPrefix ? {} : suggestFix(f.c.rows)) };
    return { ...f, fix: fx, s: score(f.c.rows, fx) };
  }).sort((a, b) => b.s.rank - a.s.rank || b.s.known - a.s.known || b.s.kept.length - a.s.kept.length);
  const top = flags.all ? ranked : ranked.slice(0, 5);
  top.forEach((r, i) => {
    console.log(`\n=== Candidate ${i + 1}: ${r.c.reader}, ${r.c.why} ===`);
    console.log(`  options: ${ts({ ...(r.fetchUrl ? { fetch: r.fetchUrl } : {}), ...r.c.options })}`);
    if (r.c.alternatives?.length) console.log(`  other number fields: ${r.c.alternatives.slice(0, 8).join(", ")}`);
    if (r.fix.labelPrefix) console.log(`  labelPrefix: ${ts(r.fix.labelPrefix)} (labels written without the family)`);
    show(r.c.rows, r.fix, i === 0);
  });
  if (ranked.length > top.length) console.log(`\n(${ranked.length - top.length} more candidates; --all shows them)`);
  const best = ranked[0];
  printConfig(best.c, url, best.fetchUrl, body, best.fix, browser);
}

main().then(() => closeBrowser()).catch(async (e) => { console.error(e instanceof Error ? e.message : e); await closeBrowser(); process.exit(1); });
