#!/usr/bin/env node
// Priors CLI and MCP server. One file, no dependencies, Node 18+.
// Docs: https://mypriors.com/cli
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const CONFIG = process.env.PRIORS_CONFIG || join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "priors", "config.json");
const readConfig = () => { try { return JSON.parse(readFileSync(CONFIG, "utf8")); } catch { return {}; } };
const cfg = readConfig();
const BASE = (process.env.PRIORS_URL || cfg.url || "https://mypriors.com").replace(/\/$/, "");
const TOKEN = process.env.PRIORS_TOKEN || cfg.token || "";

/* ------------------------------ arguments ------------------------------ */

function parse(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { pos.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      if (v !== undefined) flags[k] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}
const asNum = (v) => (v === undefined || v === true ? undefined : Number(v));
const list = (v) => (v === undefined || v === true ? undefined : String(v).split(",").map((x) => x.trim()).filter(Boolean));

/** An index from --index: a handle, link or encoded string stays text; JSON becomes an object; --weights a=1,b=2 builds one. */
function indexArg(flags) {
  if (flags.weights) {
    const weights = {};
    for (const kv of String(flags.weights).split(",")) { const [k, v] = kv.split(":"); weights[k.trim()] = Number(v ?? 1); }
    return { name: flags.name || "Custom", weights };
  }
  const x = flags.index;
  if (x === undefined || x === true) return undefined;
  if (String(x).trim().startsWith("{")) return JSON.parse(x);
  if (String(x).startsWith("@file:")) return JSON.parse(readFileSync(String(x).slice(6), "utf8"));
  return String(x);
}

/* -------------------------------- network ------------------------------- */

async function call(tool, args = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api/tools/${tool}`, { method: "POST", headers: { "content-type": "application/json", "user-agent": `priors-cli/${VERSION}`, ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) }, body: JSON.stringify(args) });
  } catch (e) { fail(`Could not reach ${BASE}: ${e.message}`); }
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 300) }; }
  if (!res.ok) fail(body.error || `HTTP ${res.status}`, res.status === 401 ? "Run `priors login` with your agent token (mint one on your page under Edit page, Agent access)." : "");
  return body;
}
function fail(msg, hint) { console.error(`priors: ${msg}`); if (hint) console.error(hint); process.exit(1); }

/* -------------------------------- output -------------------------------- */

const isTTY = process.stdout.isTTY;
const dim = (s) => (isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (isTTY ? `\x1b[1m${s}\x1b[0m` : s);
const cell = (v) => (v == null ? "" : typeof v === "boolean" ? (v ? "yes" : "") : typeof v === "number" ? String(v) : String(v));
function table(rows, cols) {
  const widths = cols.map(([k, label, , w]) => Math.min(w || 40, Math.max(label.length, ...rows.map((r) => cell(get(r, k)).length))));
  const fmt = (vals) => vals.map((v, i) => (cols[i][2] === "r" ? v.padStart(widths[i]) : v.padEnd(widths[i]))).join("  ").trimEnd();
  const out = [dim(fmt(cols.map(([, l]) => l)))];
  for (const r of rows) out.push(fmt(cols.map(([k], i) => cell(get(r, k)).slice(0, widths[i]))));
  return out.join("\n");
}
const get = (r, k) => (typeof k === "function" ? k(r) : r[k]);
const json = (v) => console.log(JSON.stringify(v, null, 2));
const out = (flags, v, render) => (flags.json || !render ? json(v) : console.log(render(v)));

/* ------------------------------- commands ------------------------------- */

const money = (x) => (x == null ? "" : x >= 10 ? `$${x.toFixed(0)}` : x >= 1 ? `$${x.toFixed(2)}` : `$${x.toFixed(3)}`);
const RENDER = {
  rank_models: (r) => `${bold(r.index.name)}${r.index.page ? ` (@${r.index.page})` : ""}  ${dim(`data ${r.index.snapshot}, ${r.total} ranked`)}\n${r.benchmarks.map((b) => `${b.sharePct}% ${b.name}`).join("  ·  ")}\n\n` +
    table(r.rows, [["rank", "#", "r", 3], ["model", "model", "l", 26], ["effort", "effort", "l", 8], [(x) => x.score?.toFixed(1), "score", "r", 6], [(x) => (x.measuredShare != null ? `${x.measuredShare}%` : ""), "meas.", "r", 5], [(x) => money(x.costUsd), "cost/task", "r", 9], [(x) => x.speedTps, "tok/s", "r", 6], [(x) => (x.onFrontier ? "◆" : ""), "", "l", 1]]),
  list_benchmarks: (r) => `${r.total} benchmarks\n` + table(r.benchmarks, [["id", "id", "l", 34], ["name", "name", "l", 34], ["category", "category", "l", 12], ["models", "models", "r", 6], ["lastUpdated", "updated", "l", 10]]),
  get_benchmark: (r) => `${bold(r.benchmark.name)}  ${dim(`${r.benchmark.unit}, ${r.benchmark.higherIsBetter ? "higher" : "lower"} is better, ${r.total} rows`)}\n${r.benchmark.url}\n${r.benchmark.description}\n\n` +
    table(r.rows, [["rank", "#", "r", 3], ["model", "model", "l", 28], ["effort", "effort", "l", 8], ["value", "value", "r", 9], [(x) => (x.ci ? `${x.ci[0]}–${x.ci[1]}` : ""), "ci", "l", 14], [(x) => money(x.costUsd), "cost/task", "r", 9]]),
  list_models: (r) => `${r.total} models\n` + table(r.models, [["id", "id", "l", 30], ["name", "name", "l", 26], ["lab", "lab", "l", 14], ["released", "released", "l", 10], [(x) => (x.openWeights ? "open" : ""), "", "l", 4], [(x) => x.efforts.join(","), "efforts", "l", 30]]),
  index_history: (r) => `${bold(r.name)} (${r.mode})\n` + r.frames.filter((_, i, a) => i === 0 || i === a.length - 1 || i % Math.max(1, Math.floor(a.length / 12)) === 0).map((f) => `${f.date}  ${f.rows.map((x) => `${x.model} ${x.score}`).join("  ·  ")}`).join("\n"),
  explore_pages: (r) => table(r, [["handle", "handle", "l", 22], ["name", "name", "l", 24], ["mainIndex", "main index", "l", 24], ["benchmarks", "bench", "r", 5], ["updated", "updated", "l", 10]]),
  data_status: (r) => `data ${r.date}  built ${r.generatedAt}\n${r.models} models · ${r.benchmarks} benchmarks · ${r.measurements} measurements · ${r.labs} labs · ${r.sources} sources`,
  index_link: (r) => `builder  ${r.builder}\ncard     ${r.card}\n` + Object.entries(r.charts).map(([k, v]) => `${k.padEnd(14)} ${v}`).join("\n"),
  theme_presets: (r) => table(r, [["id", "id", "l", 12], ["name", "name", "l", 20], [(x) => (x.dark ? "dark" : "light"), "mode", "l", 5], ["pair", "pair", "l", 12]]),
};
const show = (tool, flags, v) => out(flags, v, RENDER[tool]);

const HELP = `priors ${VERSION}: rank AI models with benchmark indexes, from your terminal or your agent.

Read (no sign-in)
  priors rank [--top 25] [--all] [--lab anthropic] [--index <ref>]   leaderboard under an index
  priors model <name>                       one model: ranking, every benchmark value
  priors benchmarks [words] [--category c]  benchmark catalog
  priors bench <name> [--limit 50]          one benchmark's leaderboard as published
  priors models [words] [--lab l] [--open]  models in the data
  priors compare <a> <b>                    why a ranks above b, benchmark by benchmark
  priors explain <model>                    why a model ranks where it does
  priors search <words>                     find benchmarks by what they measure
  priors mix                                the index's shares and top of the ranking
  priors try --weights simplebench:50,arc-agi-3:50   test a mix (nothing saved)
  priors history [--mode adapting]          the ranking over time
  priors link                               share links for an index
  priors page <handle>                      a published page
  priors explore [words]                    published pages
  priors status                             data freshness

Your page (needs a token)
  priors login [token]   priors logout   priors whoami
  priors page-set [--name n] [--bio b] [--avatar url]
  priors index ls | set <file.json|json> | rm <id>
  priors section ls | set <file.json|json> [--at n] | rm <id>
  priors theme [--preset id] [--accent #hex] [--mode fixed|auto] [--surface bone|white] [--css file.css]
  priors import <file.json>      add your own benchmark   priors imports   list them

Everything else
  priors tools                   every tool and what it takes
  priors call <tool> [json | key=value ...]   run any tool (full control)
  priors mcp                     run as a stdio MCP server for your agent
  priors update                  fetch the latest priors.mjs

An index (--index) is a @handle ("@adamholter", "@adamholter/coding"), a mypriors.com link, or JSON; --weights a:3,b:1 builds one.
--json prints raw JSON; --url or PRIORS_URL points at another server; PRIORS_TOKEN overrides the saved token.`;

function parseJsonOrFile(s, what) {
  if (!s) fail(`${what}: give a JSON file or inline JSON.`);
  try { return JSON.parse(existsSync(s) ? readFileSync(s, "utf8") : s); } catch (e) { fail(`${what}: not valid JSON (${e.message}).`); }
}

async function prompt(q) {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((r) => rl.question(q, (a) => { rl.close(); r(a.trim()); }));
}

async function main() {
  const { pos, flags } = parse(process.argv.slice(2));
  const cmd = pos[0], rest = pos.slice(1);
  if (cmd === "version" || flags.version) return console.log(VERSION);
  if (!cmd || cmd === "help" || flags.help || flags.h) return console.log(HELP);
  const index = indexArg(flags);
  const withIndex = (a) => (index === undefined ? a : { ...a, index });

  switch (cmd) {
    case "rank": return show("rank_models", flags, await call("rank_models", withIndex({ top: asNum(flags.top), efforts: flags.all ? "all" : undefined, lab: flags.lab === true ? undefined : flags.lab })));
    case "model": return json(await call("get_model", withIndex({ model: rest.join(" ") })));
    case "benchmarks": return show("list_benchmarks", flags, await call("list_benchmarks", { query: rest.join(" ") || undefined, category: flags.category, limit: asNum(flags.limit) }));
    case "bench": return show("get_benchmark", flags, await call("get_benchmark", { benchmark: rest.join(" "), limit: asNum(flags.limit), effort: flags.effort }));
    case "models": return show("list_models", flags, await call("list_models", { query: rest.join(" ") || undefined, lab: flags.lab, open_weights: flags.open ? true : flags.closed ? false : undefined, limit: asNum(flags.limit) }));
    case "compare": return json(await call("compare_models", withIndex({ a: rest[0], b: rest[1] })));
    case "explain": return json(await call("explain_model", withIndex({ model: rest.join(" ") })));
    case "search": return json(await call("search_benchmarks", withIndex({ query: rest.join(" ") })));
    case "mix": return json(await call("get_mix", withIndex({})));
    case "try": {
      const weights = {};
      for (const kv of String(flags.weights || "").split(",").filter(Boolean)) { const [k, v] = kv.split(":"); weights[k] = Number(v ?? 1); }
      if (!Object.keys(weights).length) fail("usage: priors try --weights simplebench:50,arc-agi-3:50 [--index <ref>]");
      return json(await call("try_mix", { weights, ...(typeof flags.index === "string" ? { index: flags.index } : {}) }));
    }
    case "history": return show("index_history", flags, await call("index_history", withIndex({ mode: flags.mode, top: asNum(flags.top) })));
    case "link": return show("index_link", flags, await call("index_link", withIndex({})));
    case "page": return json(await call("get_page", { handle: rest[0] }));
    case "explore": return show("explore_pages", flags, await call("explore_pages", { query: rest.join(" ") || undefined, limit: asNum(flags.limit) }));
    case "status": return show("data_status", flags, await call("data_status"));
    case "themes": return show("theme_presets", flags, await call("theme_presets"));
    case "tools": {
      const { tools } = await (await fetch(`${BASE}/api/tools`)).json();
      if (flags.json) return json(tools);
      return console.log(tools.map((t) => `${bold(t.name)}${t.write ? dim("  (token)") : ""}\n  ${t.description.split(". ")[0]}.\n  ${dim(Object.keys(t.inputSchema.properties || {}).map((k) => ((t.inputSchema.required || []).includes(k) ? `${k}*` : k)).join(", ") || "no arguments")}`).join("\n"));
    }
    case "call": {
      const tool = rest[0]; if (!tool) fail("usage: priors call <tool> [json | key=value ...]");
      let args = {};
      for (const a of rest.slice(1)) {
        if (a.trim().startsWith("{")) args = { ...args, ...parseJsonOrFile(a, "arguments") };
        else if (a.includes("=")) { const [k, v] = a.split(/=(.*)/s); try { args[k] = JSON.parse(v); } catch { args[k] = v; } }
        else if (existsSync(a)) args = { ...args, ...parseJsonOrFile(a, "arguments") };
        else fail(`Cannot read argument "${a}". Use key=value, inline JSON or a JSON file.`);
      }
      return json(await call(tool, args));
    }
    case "login": {
      const token = rest[0] || process.env.PRIORS_TOKEN || (await prompt("Agent token (pri_...): "));
      if (!/^pri_[0-9a-f]{48}$/.test(token)) fail("That does not look like a Priors agent token (pri_ and 48 hex characters). Mint one on your page under Edit page, Agent access.");
      const saved = { ...readConfig(), token, ...(process.env.PRIORS_URL ? { url: BASE } : {}) };
      const res = await fetch(`${BASE}/api/tools/whoami`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{}" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) fail(body.error || "The server did not accept that token.");
      mkdirSync(dirname(CONFIG), { recursive: true }); writeFileSync(CONFIG, JSON.stringify(saved, null, 2)); try { chmodSync(CONFIG, 0o600); } catch { /* not on every platform */ }
      return console.log(`Signed in as @${body.handle}. Saved to ${CONFIG}`);
    }
    case "logout": { const c = readConfig(); delete c.token; mkdirSync(dirname(CONFIG), { recursive: true }); writeFileSync(CONFIG, JSON.stringify(c, null, 2)); return console.log("Token removed."); }
    case "whoami": { const r = await call("whoami"); if (flags.json) return json(r); return console.log(`@${r.handle}  ${r.displayName}\n${r.url}\nindices:  ${r.indices.map((i) => `${i.id} (${Object.keys(i.weights).length} benchmarks)`).join(", ")}\nsections: ${r.sections.map((s) => `${s.id}:${s.kind}`).join(", ")}\ntheme:    ${r.theme?.preset || "default"}`); }
    case "page-set": return json(await call("update_page", { displayName: flags.name === true ? undefined : flags.name, bio: flags.bio === true ? undefined : flags.bio, avatarUrl: flags.avatar === true ? undefined : flags.avatar }));
    case "index": {
      const sub = rest[0];
      if (sub === "ls") { const r = await call("whoami"); return flags.json ? json(r.indices) : console.log(r.indices.map((i) => `${bold(i.id)}  ${i.name}\n  ${Object.entries(i.weights).map(([k, v]) => `${k}:${v}`).join(", ")}`).join("\n")); }
      if (sub === "set") { const v = parseJsonOrFile(rest[1], "index"); return json(await call("upsert_index", { index: v.index ?? v, position: asNum(flags.at) })); }
      if (sub === "rm") return json(await call("delete_index", { id: rest[1] }));
      return fail("usage: priors index ls | set <file.json|json> | rm <id>");
    }
    case "section": {
      const sub = rest[0];
      if (sub === "ls") { const r = await call("whoami"); return flags.json ? json(r.sections) : console.log(r.sections.map((s) => `${s.id}  ${s.kind}${s.title ? `  “${s.title}”` : ""}${s.indexId ? `  [${s.indexId}]` : ""}${s.hidden ? "  (hidden)" : ""}`).join("\n")); }
      if (sub === "set") { const v = parseJsonOrFile(rest[1], "section"); return json(await call("upsert_section", { section: v.section ?? v, position: asNum(flags.at) })); }
      if (sub === "rm") return json(await call("remove_section", { id: rest[1] }));
      return fail("usage: priors section ls | set <file.json|json> [--at n] | rm <id>");
    }
    case "theme": return json(await call("set_theme", { preset: flags.preset === true ? undefined : flags.preset, accent: flags.accent === true ? undefined : flags.accent, mode: flags.mode === true ? undefined : flags.mode, surface: flags.surface === true ? undefined : flags.surface, serif: flags.serif === true ? undefined : flags.serif, mono: flags.mono === true ? undefined : flags.mono, css: flags.css && flags.css !== true ? (existsSync(flags.css) ? readFileSync(flags.css, "utf8") : flags.css) : undefined }));
    case "import": return json(await call("import_benchmark", parseJsonOrFile(rest[0], "import")));
    case "imports": return json(await call("list_imports"));
    case "update": {
      const res = await fetch(`${BASE}/cli/priors.mjs`);
      if (!res.ok) fail(`Download failed (${res.status}).`);
      const text = await res.text(), here = fileURLToPath(import.meta.url);
      writeFileSync(here, text); try { chmodSync(here, 0o755); } catch { /* ignore */ }
      return console.log(`Updated ${here} to ${(text.match(/const VERSION = "([^"]+)"/) || [])[1] || "latest"}.`);
    }
    case "mcp": return serveMcp();
    default: fail(`Unknown command "${cmd}". Run \`priors help\`.`);
  }
}

/* ------------------------------ stdio MCP ------------------------------- */

/** MCP over stdio: each JSON-RPC line goes to the hosted server (which holds every tool) and the reply comes back on stdout. */
async function serveMcp() {
  const rl = createInterface({ input: process.stdin });
  const pending = new Set();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    const p = (async () => {
      let msg; try { msg = JSON.parse(line); } catch { return process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`); }
      try {
        const res = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", accept: "application/json", "user-agent": `priors-cli/${VERSION}`, ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}) }, body: line });
        const text = await res.text();
        if (text.trim()) process.stdout.write(`${text.replace(/\n/g, " ")}\n`);
      } catch (e) {
        if (msg.id !== undefined) process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: `Could not reach ${BASE}: ${e.message}` } })}\n`);
      }
    })().finally(() => pending.delete(p));
    pending.add(p);
  });
  rl.on("close", async () => { await Promise.all(pending); process.exit(0); });
}

main().catch((e) => fail(e.message));
