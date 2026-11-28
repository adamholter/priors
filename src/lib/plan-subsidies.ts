import type { PlanSubsidy, SubsidySeller } from "./model-availability";

/** Pure helpers of the /subsidies page: number text, plan names, search, the plan-by-model grid and the dot scales. */
export type Model = PlanSubsidy["models"][number];
export type Measured = Model & { multiple: number };

export const measured = (models: Model[]) => models.filter((m): m is Measured => m.multiple != null);
export const times = (m: number) => `${m >= 9.95 ? Math.round(m) : m.toFixed(1)}x`;
export const feeText = (v?: number) => (v == null ? "" : `$${Number.isInteger(v) ? v : v.toFixed(2)}/mo`);
export const feeShort = (v?: number) => (v == null ? "" : `$${Number.isInteger(v) ? v : v.toFixed(2)}`);
export const usd = (v: number) => `$${v >= 100 ? Math.round(v).toLocaleString("en-US") : v >= 10 ? Math.round(v) : v.toFixed(2)}`;
/** Dollars as a grid cell holds them: "$3.2k" from a thousand up. */
export const usdc = (v: number) => (v >= 10000 ? `$${Math.round(v / 1000)}k` : v >= 1000 ? `$${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : usd(v));

/** Plans a new subscriber can no longer buy. */
export const isClosedPlan = (plan: string) => /\blegacy\b|existing subscribers/i.test(plan);
const clean = (plan: string) => plan.replace(/,?\s*(?:legacy|existing subscribers)/gi, "").replace(/\s{2,}/g, " ").trim();
const shorts = new WeakMap<SubsidySeller, (plan: string) => string>();
/** Plan names with the words every plan of the company shares taken off the front ("Claude Pro" reads "Pro"), and no "legacy" in the name. Two plans that would read alike keep their full names. */
export function shortOf(s: SubsidySeller) {
  const hit = shorts.get(s);
  if (hit) return hit;
  const names = s.plans.map((p) => clean(p.plan)), words = names.map((n) => n.split(/\s+/));
  let k = 0;
  if (names.length > 1) while (words.every((w) => w.length > k + 1 && w[k] === words[0][k])) k++;
  const cut = words.map((w) => w.slice(k).join(" ")), dup = new Set(cut.filter((c, i) => cut.indexOf(c) !== i));
  const map = new Map(s.plans.map((p, i) => [p.plan, dup.has(cut[i]) ? names[i] : cut[i]]));
  const fn = (plan: string) => map.get(plan) ?? plan;
  shorts.set(s, fn);
  return fn;
}
/** The plan a company's row stands for: its default, unless the default has no figures. */
export const rowPlanOf = (plans: PlanSubsidy[]) => plans.find((p) => p.median > 0) ?? plans[0];

/** What a search found in one company: every plan when its name matched, else the plans and models that did. `deep` opens the row. */
export type Hit = { s: SubsidySeller; plans: PlanSubsidy[]; models: Set<string> | null; deep: boolean };
export function searchSellers(sellers: SubsidySeller[], query: string): Hit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean), has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  return sellers.map((s): Hit => {
    if (!words.length || has(s.name)) return { s, plans: s.plans, models: null, deep: false };
    const models = new Set(s.plans.flatMap((p) => p.models.filter((m) => has(m.name)).map((m) => m.id))), plans = s.plans.filter((p) => has(`${s.name} ${p.plan}`) || p.models.some((m) => models.has(m.id)));
    return { s, plans, models: models.size ? models : null, deep: true };
  }).filter((h) => h.plans.length);
}
/** A plan's models, narrowed to the ones a search matched. */
export const modelsOf = (hit: Hit, p: PlanSubsidy) => (hit.models ? p.models.filter((m) => hit.models!.has(m.id)) : p.models);

/** The one log scale of the page, 1x to the best multiple (at least 100x), shared by the header, the bars and the grid. */
export const TICKS = [1, 3, 10, 30, 100];
export const scaleHigh = (sellers: SubsidySeller[]) => Math.max(100, ...sellers.flatMap((s) => s.plans.flatMap((p) => measured(p.models).map((m) => m.multiple))));
/** The shared log scale as the page draws with it: `share` is 0 to 1, `pct` the same as CSS, `color` a lab's mark colour. */
export type Scale = { high: number; ticks: number[]; share: (m: number) => number; pct: (m: number) => string; color: (lab: string) => string };
export const logShare = (m: number, high: number) => Math.log(Math.max(m, 1)) / Math.log(high);

/** The dollar scale for what a fee buys: $5 to $30k on one log axis, wider when a figure falls outside. */
export type DScale = { lo: number; hi: number; share: (v: number) => number };
export function dollarScale(sellers: SubsidySeller[]): DScale {
  let min = Infinity, max = 0;
  for (const s of sellers) for (const p of s.plans) if (p.feeUsd != null) for (const m of measured(p.models)) { const v = p.feeUsd * m.multiple; min = Math.min(min, p.feeUsd, v); max = Math.max(max, v); }
  const lo = Math.min(5, min), hi = Math.max(30000, max);
  return { lo, hi, share: (v) => Math.log(Math.min(Math.max(v, lo), hi) / lo) / Math.log(hi / lo) };
}

/** The lab whose models a plan mostly sells (first seen wins a tie), so one bar wears one colour. */
export function mainLab(p: PlanSubsidy) {
  const n = new Map<string, number>();
  for (const m of measured(p.models)) n.set(m.lab, (n.get(m.lab) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/** The two marks a company bar can name: where its median ends and its best model. `x` is in px on a strip `width` wide. */
export type Mark = { k: "median" | "best"; tick: boolean; text: string; x: number };
export function trackMarks(plan: PlanSubsidy, share: (m: number) => number, width: number): Mark[] {
  const ms = measured(plan.models);
  if (!ms.length) return [];
  const best = ms[0], one = ms.length === 1;
  return [
    { k: "median", tick: false, text: `median ${times(plan.median)}`, x: share(plan.median) * width },
    { k: "best", tick: true, text: one ? `${best.name} ${times(best.multiple)}` : `${best.name} ${times(best.multiple)} best`, x: share(best.multiple) * width },
  ];
}

/** The mark nearest to `px` when it is within `reach`. */
export function nearestMark<G extends { x: number }>(marks: G[], px: number, reach: number): G | null {
  let best: G | null = null;
  for (const g of marks) if (!best || Math.abs(g.x - px) < Math.abs(best.x - px)) best = g;
  return best && Math.abs(best.x - px) <= reach ? best : null;
}

/** Plans with figures for the models on show: one grid column each. */
export const gridPlans = (hit: Hit) => hit.plans.filter((p) => measured(modelsOf(hit, p)).length);
/** Columns in the grid: six to a table on a desktop, three on a phone. */
export function chunk<T>(items: T[], per: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += per) out.push(items.slice(i, i + per));
  return out;
}

export type GridRow = { m: Model; cells: Map<string, Model> };
/** One row per model across `plans`, best figure first (the sorted plan's figure first when one is chosen), models with no figure left out. */
export function gridRows(hit: Hit, plans: PlanSubsidy[], sort: string | null): GridRow[] {
  const byId = new Map<string, GridRow>();
  for (const p of plans) for (const m of modelsOf(hit, p)) { const r = byId.get(m.id) ?? byId.set(m.id, { m, cells: new Map() }).get(m.id)!; r.cells.set(p.plan, m); }
  const best = (r: GridRow) => Math.max(0, ...[...r.cells.values()].map((m) => m.multiple ?? 0));
  const at = (r: GridRow) => r.cells.get(sort ?? "")?.multiple ?? -1;
  return [...byId.values()].filter((r) => best(r) > 0).sort((a, b) => (sort ? at(b) - at(a) : 0) || best(b) - best(a) || a.m.name.localeCompare(b.m.name));
}
