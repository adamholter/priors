/**
 * Memory and payload per page, against a running production build.
 *   BASE=http://localhost:48798 node scripts/verify/memory.mjs [--json out.json] [--server-pid <pid>]
 * For each route, in a fresh browser context: bytes transferred (HTML, scripts, data), JS heap after a forced
 * garbage collection, and DOM nodes. With --server-pid, the server's resident memory after every route has
 * been served twice. Run it before and after a change; the numbers move a few percent run to run.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:48798";
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const ROUTES = (process.env.ROUTES?.split(",")) ?? ["/", "/builder", "/explore", "/benchmarks", "/benchmarks/frontiercode-2.0-main", "/models/claude-opus-5.5", "/compare?a=preset:aa&b=preset:general", "/rank", "/model-finder", "/history", "/adamholter"];
const MB = (b) => +(b / 1048576).toFixed(2);
const rss = (pid) => { try { return +execFileSync("ps", ["-o", "rss=", "-p", String(pid)]).toString().trim() * 1024; } catch { return 0; } };

const browser = await chromium.launch({ args: ["--js-flags=--expose-gc"] });
const rows = [];
for (const route of ROUTES) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable"); await cdp.send("Performance.enable");
  const types = new Map(); const bytes = { document: 0, script: 0, fetch: 0, other: 0 };
  cdp.on("Network.responseReceived", (e) => types.set(e.requestId, e.type));
  cdp.on("Network.loadingFinished", (e) => {
    const t = (types.get(e.requestId) ?? "Other").toLowerCase();
    const k = t === "document" ? "document" : t === "script" ? "script" : t === "fetch" || t === "xhr" ? "fetch" : "other";
    bytes[k] += e.encodedDataLength;
  });
  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1500);
  const settled = Date.now() - t0;
  await cdp.send("HeapProfiler.collectGarbage");
  const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  rows.push({ route, heapMB: MB(m.JSHeapUsedSize), nodes: m.Nodes, docKB: Math.round(bytes.document / 1024), jsKB: Math.round(bytes.script / 1024), fetchKB: Math.round(bytes.fetch / 1024), settledMs: settled });
  await context.close();
}
await browser.close();

const pid = arg("--server-pid");
let server;
if (pid) {
  // Serve every route again with plain requests, so the number reflects a warm server, not one that has seen each page once.
  for (const route of ROUTES) await fetch(`${BASE}${route}`).then((r) => r.arrayBuffer()).catch(() => {});
  server = { rssMB: MB(rss(pid)) };
}
console.table(rows);
const total = rows.reduce((a, r) => ({ heapMB: a.heapMB + r.heapMB, docKB: a.docKB + r.docKB, jsKB: a.jsKB + r.jsKB, fetchKB: a.fetchKB + r.fetchKB }), { heapMB: 0, docKB: 0, jsKB: 0, fetchKB: 0 });
console.log("total", { heapMB: +total.heapMB.toFixed(1), docKB: total.docKB, jsKB: total.jsKB, fetchKB: total.fetchKB }, server ? { serverRssMB: server.rssMB } : "");
const out = arg("--json");
if (out) writeFileSync(out, JSON.stringify({ base: BASE, at: new Date().toISOString(), rows, total, server }, null, 2));
