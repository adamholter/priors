/**
 * Runs npm scripts side by side, prefixing each line with the script's name, and fails if any fails.
 *   node scripts/ops/parallel.mjs check:unit check:types check:lint
 * The checks and the build each take most of a minute on Vercel's 4 cores; one after another they were most of a deploy.
 */
import { spawn } from "node:child_process";

const names = process.argv.slice(2);
if (!names.length) { console.error("usage: node scripts/ops/parallel.mjs <npm script>..."); process.exit(2); }
const width = Math.max(...names.map((n) => n.length));
const started = Date.now();
const results = await Promise.all(names.map((name) => new Promise((resolve) => {
  const t0 = Date.now();
  const child = spawn("npm", ["run", "--silent", name], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "0" } });
  const tag = `[${name.padEnd(width)}] `;
  for (const stream of [child.stdout, child.stderr]) {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop();
      for (const line of lines) process.stdout.write(tag + line + "\n");
    });
    stream.on("end", () => { if (rest) process.stdout.write(tag + rest + "\n"); });
  }
  child.on("close", (code) => resolve({ name, code: code ?? 1, secs: ((Date.now() - t0) / 1000).toFixed(1) }));
})));
for (const r of results) console.log(`${r.code === 0 ? "ok  " : "FAIL"} ${r.name} (${r.secs}s)`);
console.log(`parallel: ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(results.some((r) => r.code !== 0) ? 1 : 0);
