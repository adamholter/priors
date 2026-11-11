/**
 * Serves the production build and runs the browser checks against it: smoke (every route, onboarding
 * end to end) and interactions (the builder's controls). CI runs this after `npm run build`.
 *   npm run build && npm run e2e
 * Smoke and the interaction shards (SHARD in interactions.mjs) run side by side: one after another they took
 * about 140s of every push, side by side about a third of that. E2E_SHARDS sets the interaction shard count.
 */
import { spawn } from "node:child_process";

const PORT = process.env.E2E_PORT ?? "48740";
const BASE = `http://localhost:${PORT}`;
const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: ["ignore", "inherit", "inherit"] });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

const run = (script, tag, env = {}) => new Promise((resolve) => {
  const child = spawn("node", [script], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, BASE, ...env } });
  for (const stream of [child.stdout, child.stderr]) {
    let rest = "";
    stream.on("data", (chunk) => { const lines = (rest + chunk).split("\n"); rest = lines.pop(); for (const l of lines) process.stdout.write(`[${tag}] ${l}\n`); });
    stream.on("end", () => { if (rest) process.stdout.write(`[${tag}] ${rest}\n`); });
  }
  child.on("close", (code) => resolve(code ?? 1));
});
const SHARDS = Math.max(1, Number(process.env.E2E_SHARDS ?? 3));

let code = 1;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/privacy`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 59) throw new Error("server did not start");
  }
  const t0 = Date.now();
  const codes = await Promise.all([
    run("scripts/verify/smoke.mjs", "smoke"),
    ...Array.from({ length: SHARDS }, (_, i) => run("scripts/verify/interactions.mjs", SHARDS > 1 ? `interactions ${i}/${SHARDS}` : "interactions", SHARDS > 1 ? { SHARD: `${i}/${SHARDS}` } : {})),
  ]);
  console.log(`e2e: ${codes.every((c) => c === 0) ? "all passed" : "FAILED"} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  code = codes.find((c) => c !== 0) ?? 0;
} finally {
  stop();
}
process.exit(code);
