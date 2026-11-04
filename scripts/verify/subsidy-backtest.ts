/**
 * Hides each independently sourced plan row in Real API Pricing and predicts it from the same plan's other rows.
 * `npx tsx scripts/verify/subsidy-backtest.ts`. A row computed upstream from another row ("derived") is never an answer or an
 * input, and plan-wide budget rules are left out of the answers, because each would grade a method against itself.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { blendedApiPrice, CODEX_LIMITS_BENCHMARK } from "../../src/data/subscription";

type Point = { id: string; model: string; vendor: string; billing: string; unmetered?: boolean; promo_until?: unknown; real_usd_per_mtok: number; list_blended_usd_per_mtok?: number; data_date?: string | null; data_date_kind?: string; note?: string };
type Row = Point & { plan: string; api: number; real: number; share: number };
const MIX = { cache: 0.97, input: 0.025, output: 0.005 };
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const tier = (m: string) => m.replace(/-contributor$/, "").replace(/\d+(\.\d+)*/g, "").replace(/-+/g, "-").replace(/-$/, "");
const when = (p: Point) => (p.data_date ?? "").split("~").pop() ?? "";
const closest = (m: Row, s: Row[]) => s.reduce((a, b) => (Math.abs(Math.log(b.api / m.api)) < Math.abs(Math.log(a.api / m.api)) ? b : a));
const newest = (s: Row[]) => s.reduce((a, b) => (when(b) > when(a) ? b : a));
const budgetRule = (p: Point) => /共享月池|月池|shared|统一标准负载/.test(p.note ?? "");

const RULES: Record<string, (m: Row, s: Row[]) => number> = {
  "median share": (m, s) => m.api * median(s.map((x) => x.share)),
  "closest API price": (m, s) => m.api * closest(m, s).share,
  "newest sibling": (m, s) => m.api * newest(s).share,
  "same tier, else median": (m, s) => { const t = s.filter((x) => tier(x.model) === tier(m.model)); return m.api * (t.length ? closest(m, t).share : median(s.map((x) => x.share))); },
  "same tokens": (_, s) => median(s.map((x) => x.real)),
};

async function main() {
  const { points } = await (await fetch("https://raw.githubusercontent.com/FeiZhuLulu/real-api-pricing/main/derived/points.json")).json() as { points: Point[] };
  const snapshot = JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString());
  const prices = new Map<string, number>(), limits = new Map<string, number>();
  for (const v of snapshot.variants) { const m = v.sourceModel?.metadata; if (m?.price1mInputTokens && !prices.has(v.modelId)) prices.set(v.modelId, blendedApiPrice({ input: m.price1mInputTokens, output: m.price1mOutputTokens, cached: m.price1mCachedInputTokens ?? m.cacheHitPrice }, MIX)); }
  for (const o of snapshot.observations) if (o.benchmarkId === CODEX_LIMITS_BENCHMARK) limits.set(o.variantId.split("@")[0], o.value);
  const rows = points.flatMap((p): Row[] => {
    const api = p.list_blended_usd_per_mtok || prices.get(p.model.replace("gemini-4-argon", "gemini-4").replace(/-contributor$/, ""));
    return p.billing === "subscription" && !p.unmetered && !p.promo_until && p.real_usd_per_mtok > 0 && api ? [{ ...p, plan: p.id.split("::")[0], api, real: p.real_usd_per_mtok, share: p.real_usd_per_mtok / api }] : [];
  });
  const usable = rows.filter((r) => r.data_date_kind !== "derived");
  const answers = usable.filter((r) => !budgetRule(r));
  const score = (rule: (m: Row, s: Row[]) => number, pastOnly: boolean, from = answers, pool = usable) => {
    const errors = from.flatMap((m) => { const s = pool.filter((x) => x.plan === m.plan && x.model !== m.model && (!pastOnly || (when(x) && when(x) <= when(m)))); return s.length ? [Math.abs(Math.log(rule(m, s) / m.real))] : []; });
    return `${String(errors.length).padStart(3)} rows, mean miss ${Math.exp(errors.reduce((a, b) => a + b, 0) / errors.length).toFixed(2)}x, typical ${Math.exp(median(errors)).toFixed(2)}x, within 1.25x ${(errors.filter((e) => e <= Math.log(1.25)).length / errors.length * 100).toFixed(0)}%`;
  };
  console.log(`${rows.length} plan rows, ${answers.length} usable as answers`);
  for (const [title, past] of [["Any sibling", false], ["New model: only siblings measured no later", true]] as const) { console.log(`\n${title}`); for (const [name, rule] of Object.entries(RULES)) console.log(`  ${score(rule, past)}  ${name}`); }
  const plus = usable.filter((r) => r.plan === "chatgpt_plus" && limits.has(r.model));
  console.log("\nChatGPT Plus, Codex-listed models");
  console.log(`  ${score(RULES["median share"], false, plus, plus)}  median share (live)`);
  console.log(`  ${score((m, s) => median(s.map((x) => x.real * limits.get(x.model)! / limits.get(m.model)!)), false, plus, plus)}  message limits (retired)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
