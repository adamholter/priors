/**
 * Verified benchmark creators: who may edit a benchmark's page on Priors (convex/benchmarkPages.ts). Adam verifies a creator himself,
 * gets their Priors handle, then:
 *   npm run creators -- grant <benchmark> <handle> [--note "how verified"]
 *   npm run creators -- revoke <benchmark> <handle>
 *   npm run creators -- clear <benchmark>          remove every block creators added to that page
 *   npm run creators -- list [benchmark]
 * <benchmark> is an id, a name or a page slug, checked against the live data so a typo cannot grant a benchmark that does not exist.
 * Writes go to production (`npx convex run --prod`); add --dev for the dev deployment.
 */
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(`--${name}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
const dev = args.includes("--dev"); if (dev) args.splice(args.indexOf("--dev"), 1);
const note = flag("note");
const [cmd, benchArg, handle] = args;

const run = (fn: string, payload: Record<string, unknown>) => {
  const out = execFileSync("npx", ["convex", "run", ...(dev ? [] : ["--prod"]), `benchmarkPages:${fn}`, JSON.stringify(payload)], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  console.log(out.trim());
};

async function benchmarkId(name: string) {
  process.env.SNAPSHOT_BASE_URL ??= "https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots";
  const { loadSnapshot } = await import("../../src/data/load");
  const { resolveBenchmark } = await import("../../src/agent/resolve");
  const s = await loadSnapshot();
  if (!s) throw new Error("Could not load the live benchmark data.");
  const id = resolveBenchmark(s, name.replace(/^.*\/benchmarks\//, ""));
  if (!id) throw new Error(`No benchmark matches "${name}".`);
  console.error(`benchmark: ${id} (${s.benchmarks.find((b) => b.id === id)?.name})`);
  return id;
}

const usage = "usage: npm run creators -- grant|revoke <benchmark> <handle> [--note text] | clear <benchmark> | list [benchmark]   (--dev for the dev deployment)";
if (cmd === "grant" || cmd === "revoke") {
  if (!benchArg || !handle) throw new Error(usage);
  run(cmd, { benchmarkId: await benchmarkId(benchArg), handle: handle.replace(/^@/, ""), ...(cmd === "grant" && note ? { note } : {}) });
} else if (cmd === "clear") {
  if (!benchArg) throw new Error(usage);
  run("clearPage", { benchmarkId: await benchmarkId(benchArg) });
} else if (cmd === "list") {
  run("list", benchArg ? { benchmarkId: await benchmarkId(benchArg) } : {});
} else {
  console.error(usage);
  process.exit(1);
}
