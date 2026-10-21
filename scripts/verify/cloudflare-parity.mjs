import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

// Read-only route parity. Browser sign-in, interactions and PostHog read-back are separate gates.
const base = process.env.BASE || "https://priors.adamholter.workers.dev";
const reference = process.env.REFERENCE || "https://mypriors.com";
const index = "Artificial Analysis|aa-intelligence-index-v4.3.2:100|strict=50|bars=best|est=0|var=best|effort=strict|focus=capabilities";
const recipe = Buffer.from(JSON.stringify({ type: "bar", metric: "index", top: 5 })).toString("base64url");
const chart = new URLSearchParams({ i: index, c: recipe });
const cases = [
  ["/"], ["/builder"], ["/explore"], ["/model-finder"], ["/models/gpt-6-sol"], ["/adamholter"],
  ["/og", "png"], ["/og?c=cost", "png"], ["/og?design=radar", "png"],
  ["/models/gpt-6-sol/opengraph-image", "png"], ["/adamholter/opengraph-image", "png"],
  ["/intro/podium-dark.png", "png"], ["/sitemap.xml", "xml"], ["/skill"],
  ["/api/snapshot?view=meta", "json"], ["/api/snapshot?view=core", "json"],
  ["/api/library", "json"], ["/api/history", "json"], ["/api/history?mode=adapting", "json"],
  ["/api/benchmarks", "json"], ["/api/lineup?handle=adamholter", "json"],
  [`/api/chart?${chart}`, "json"], ["/api/agent", "json"],
  ["/api/chart?i=invalid&c=invalid", "json", "GET", 400],
  ["/api/snapshot?date=invalid", "json", "GET", 400],
  ["/api/assistant", "json", "POST", 401], ["/api/agent", "json", "POST", 401],
  ["/api/snapshot", "json", "POST", 403],
];

async function inspect(origin, route, kind = "html", method = "GET", expected = 200) {
  try {
    const response = await fetch(origin + route, { method, signal: AbortSignal.timeout(60000), ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {}) });
    const body = Buffer.from(await response.arrayBuffer());
    const type = response.headers.get("content-type") || "";
    const valid = kind === "png" ? body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : type.includes(kind === "html" ? "text/html" : kind);
    return { status: response.status, type, bytes: body.length, cacheControl: response.headers.get("cache-control"), hash: createHash("sha256").update(body).digest("hex"), ok: response.status === expected && valid };
  } catch (error) { return { ok: false, error: error.message }; }
}

const results = [];
for (const args of cases) {
  const [actual, expected] = await Promise.all([inspect(base, ...args), inspect(reference, ...args)]);
  const sameBytes = actual.hash !== undefined && actual.hash === expected.hash;
  const row = { route: args[0], method: args[2] || "GET", actual, reference: expected, sameBytes };
  results.push(row);
  console.log(`${actual.ok && expected.ok ? "PASS" : "FAIL"} ${row.method} ${row.route} ${actual.status ?? actual.error}/${expected.status ?? expected.error}${sameBytes ? " identical" : ""}`);
}
await mkdir("logs/cloudflare-migration", { recursive: true });
const passed = results.filter(r => r.actual.ok && r.reference.ok).length;
await writeFile("logs/cloudflare-migration/parity.json", JSON.stringify({ at: new Date().toISOString(), base, reference, passed, total: results.length, results }, null, 2));
console.log(`${passed}/${results.length} route checks passed against ${reference}`);
if (passed !== results.length) process.exitCode = 1;
