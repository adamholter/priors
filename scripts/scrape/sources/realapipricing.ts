/**
 * Real API Pricing (realapipricing.com, github.com/FeiZhuLulu/real-api-pricing): what a subscription
 * plan costs per million tokens when its whole monthly allowance is used — monthly fee ÷ measured
 * monthly tokens. One row per plan × model in `derived/points.json`, each with a confidence grade
 * and the workload convention used to turn a dollar pool into tokens.
 *
 * We publish one model-level proxy: the token price on the plan that subsidizes the model most, whoever
 * sells it (Adam, November 18, 2026): the lab's own plans and resellers or harnesses alike (OpenCode Go, Droid, Command
 * Code, …). Plans no longer sold count only when nothing else is, and graded "low" rows only when nothing better exists.
 * Plans sold as a dollar budget at the seller's API rates (Mistral Vibe) come from `BUDGET_PLANS`. The engine divides this by the API list price at the same workload
 * to get the share of API cost a subscriber pays (`src/data/subscription.ts`).
 */
import type { Source, ScrapeResult, RawRow } from "../../../src/data/types";
import { normalizeLabel } from "../../../src/data/normalize";
import { blendedApiPrice, offPeakOf, planDisplayName, SUBSCRIPTION_BENCHMARK, type PlanCaveat, type SubscriptionDetails, type TokenMix } from "../../../src/data/subscription";
import { BUDGET_PLANS, LEGACY_PLANS, type BudgetRates, LIST_PRICES_UNTIL, PLAN_CHANGES, PLAN_MULTIPLES, SUBSIDY_ASSUMPTIONS, SUBSIDY_OVERRIDES, planUsageEstimates } from "./subscription-overrides";

const SITE = "https://realapipricing.com";
const REPO = "https://github.com/FeiZhuLulu/real-api-pricing";
const RAW = "https://raw.githubusercontent.com/FeiZhuLulu/real-api-pricing/main";

type Point = {
  id: string; plan: string; plan_en?: string | null; billing: string; model: string; model_display: string; vendor: string;
  workload?: string; list_price?: { cached: number; input: number; output: number; currency: string } | null;
  price_usd?: number | null; real_usd_per_mtok: number; confidence: string; unmetered?: boolean; data_date?: string | null;
  /** Set on curated budget points only. */
  preliminary?: PlanCaveat;
};
export type Points = { generatedAt: string; points: Point[] };
export type Conventions = { usdPerCny: number; standardTokenMix: TokenMix; lowCacheTokenMix: TokenMix; anthropicTokenMix: { cache: number; cacheWrite: number; output: number } };
export type Channels = { channels: [string, string][] };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** Real API Pricing model slugs whose Priors id differs. Gemini 4 Argon was Gemini 4's first tier, so it keeps the bare id. */
const PRIORS_IDS: Record<string, string> = { "gemini-4-argon": "gemini-4" };

/** OpenCode Go: the docs give each plan's fee, the model list each model's monthly dollar limit on each plan. Real API Pricing lags them, so they replace its rows. */
export const OPENCODE_GO_DOCS = "https://opencode.ai/v2/docs/console/go";
export const OPENCODE_GO_MODELS = "https://opencode.ai/inference/go/v1/models";
const OPENCODE_PLANS = [{ planId: "opencode_go", plan: "OpenCode Go", key: "go" }, { planId: "opencode_go_plus", plan: "OpenCode Go Plus", key: "go-plus" }, { planId: "opencode_go_teams", plan: "OpenCode Go Teams", key: "go-teams" }];
const isOpenCodeGo = (id: string) => id.startsWith("opencode_go");
type OpenCodeModel = { id: string; name: string; canonical_id?: string | null; cost?: { text?: { input?: { price?: number; cache?: { read?: number } }; output?: { price?: number } }; multipliers?: { factor?: number }[] }; go?: { monthly_usage?: Record<string, number>; training?: boolean } };

/**
 * Every paid model on OpenCode Go, as points. A limit is dollars at the token prices listed beside it, so a plan's share of API price is
 * fee ÷ limit. Where a model costs more at some hours the highest rate is its list price: DeepSeek's peak rate is what Artificial Analysis
 * prices it at. Tiers that pay for usage with your prompts ("Contributor") are a different deal and are left out. Throws when either page
 * changes shape, so the last Real API Pricing rows stand.
 */
export function parseOpenCodeGo(html: string, list: { data?: OpenCodeModel[] }, mix: TokenMix, date: string): Point[] {
  const text = html.replace(/<\/t[dh]>/g, " | ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const fee = (plan: string, unit: string) => { const m = new RegExp(`\\b${plan} \\| \\$(\\d+)/${unit}`).exec(text); if (!m) throw new Error(`OpenCode Go docs: no price for ${plan}; page changed?`); return Number(m[1]); };
  const fees = [fee("Go", "month"), fee("Go Plus", "month"), fee("Go Teams", "member")];
  const points = (list.data ?? []).flatMap((m) => {
    const usage = m.go?.monthly_usage, rate = m.cost?.text, input = rate?.input?.price, output = rate?.output?.price;
    if (!usage || m.go?.training || !input || !output) return [];
    const peak = Math.max(1, ...(m.cost?.multipliers ?? []).map((x) => x.factor ?? 1));
    const list_price = { cached: +((rate?.input?.cache?.read ?? 0) * peak).toPrecision(6), input: +(input * peak).toPrecision(6), output: +(output * peak).toPrecision(6), currency: "USD" };
    // The list's id can name a family ("deepseek-v4.1-flash") whose current revision is the canonical id: both models get the row.
    const canonical = m.canonical_id?.split("/").pop()?.toLowerCase(), serves = [{ slug: canonical ?? m.id, display: m.name }, ...(canonical && canonical !== m.id ? [{ slug: m.id, display: m.name.replace(/\s+\d{4}$/, "") }] : [])].map((s) => { const n = normalizeLabel(s.display); return { ...s, model: n.ok ? n.modelId : s.slug }; });
    return OPENCODE_PLANS.flatMap(({ planId, plan, key }, i) => {
      const limit = usage[key];
      return limit > 0 ? serves.map(({ slug, model, display }): Point => ({ id: `${planId}::${slug}`, plan, plan_en: plan, billing: "subscription", model, model_display: display, vendor: m.canonical_id?.split("/")[0] ?? "OpenCode Go", workload: "standard", list_price, price_usd: fees[i], confidence: "high", data_date: date, real_usd_per_mtok: fees[i] * blendedApiPrice(list_price, mix) / limit })) : [];
    });
  });
  if (!points.length) throw new Error("OpenCode Go models: no monthly limits; response changed?");
  return points;
}

/** Cheapest tokens first; at the same token price the bigger plan first, so a median among equals lands on the middle plan. */
const cheaper = (a: Point, b: Point) => a.real_usd_per_mtok - b.real_usd_per_mtok || (b.price_usd ?? 0) - (a.price_usd ?? 0);

/** One row per model: the plan with the biggest subsidy, with every plan that sells the model in details. */
export function parseSubscriptions(json: Points, conventions: Conventions, channels: Channels, now = new Date(), stated: Point[] = []): RawRow[] {
  const budgetOf = (id: string) => BUDGET_PLANS.find((b) => id.startsWith(`${b.planId}::`));
  const channelOf = (id: string) => budgetOf(id)?.channel ?? channels.channels.find(([prefix]) => id.startsWith(prefix))?.[1];
  const mixOf = (workload?: string): TokenMix => workload === "anthropic"
    ? { cache: conventions.anthropicTokenMix.cache, input: 0, cacheWrite: conventions.anthropicTokenMix.cacheWrite, output: conventions.anthropicTokenMix.output }
    : workload === "lowCache" ? pickMix(conventions.lowCacheTokenMix) : pickMix(conventions.standardTokenMix);
  const byModel = new Map<string, Point[]>(), resold = new Map<string, Point[]>();
  const budgets = budgetPoints(conventions, now).filter((b) => !json.points.some((p) => p.id === b.id));
  const statedIds = new Set(stated.map((p) => p.id));
  // OpenCode's own list is complete, so a model Real API Pricing still shows on Go but OpenCode dropped goes too.
  for (const p of [...withMultiples(json.points.filter((p) => !statedIds.has(p.id) && !(stated.length && isOpenCodeGo(p.id))).map(changed)), ...budgets, ...stated]) {
    if (p.billing !== "subscription" || p.unmetered || !(p.real_usd_per_mtok > 0)) continue;
    const group = channelOf(p.id) === p.vendor ? byModel : resold;
    (group.get(p.model) ?? group.set(p.model, []).get(p.model)!).push(p);
  }
  const rows: RawRow[] = [];
  const taken = new Set<string>();
  // "(9/14+)" marks which generation of a plan's limits was measured; it is not part of the plan's name.
  // Time-of-day rows get Priors' names ("GLM Coding Pro ¥538 (off-peak)", "MiMo Token Plan Max (peak)"): `planDisplayName`.
  const name = (p: Point) => `${planDisplayName((p.plan_en || p.plan).replace(/\s*\(\d+\/\d+\+\)$/, ""))}${LEGACY_PLANS.some((prefix) => p.id.startsWith(prefix)) ? ", legacy" : ""}`;
  // A budget plan on another lab's model is listed with that model's first-party plans, so it can be picked. OpenCode Go states its limits the same way.
  const sameModel = (a: string, b: string) => squash(PRIORS_IDS[a] ?? a) === squash(PRIORS_IDS[b] ?? b);
  const resellers = (model: string) => [...resold].filter(([m]) => sameModel(m, model)).flatMap(([, list]) => list);
  const listOf = (all: Point[], p: Point) => {
    const until = LIST_PRICES_UNTIL.find((l) => l.model === all[0].model && now < new Date(l.until));
    return { until, list: until ? { cached: until.cached, input: until.input, output: until.output, currency: "USD" } : p.list_price ?? all.find((x) => x.list_price)?.list_price };
  };
  /** What a subscriber pays as a share of API price on this plan, at the workload it was measured with. Without a list price, its token price. */
  const shareOf = (all: Point[], p: Point) => {
    const { list } = listOf(all, p), rate = list?.currency === "CNY" ? conventions.usdPerCny : 1, api = list ? blendedApiPrice({ cached: list.cached / rate, input: list.input / rate, output: list.output / rate }, mixOf(p.workload)) : 0;
    return api > 0 ? p.real_usd_per_mtok / api : p.real_usd_per_mtok;
  };
  /**
   * The biggest subsidy among plans on sale. A "low" row counts only when it is the lab's own and the lab has nothing surer, so a thin reseller figure never sets a price
   * and a well-graded reseller does not push out a lab's only measurements. Plans within half a percent tie: the surer figure, then the lower fee.
   */
  const best = (all: Point[], own: Point[] = []) => {
    const sold = all.filter((p) => !LEGACY_PLANS.some((prefix) => p.id.startsWith(prefix)) && !/existing subscribers/i.test(name(p))), counted = sold.length ? sold : all, ownGraded = own.some((p) => counted.includes(p) && p.confidence !== "low");
    const kept = counted.filter((p) => p.confidence !== "low" || (own.includes(p) && !ownGraded)), pool = kept.length ? kept : counted;
    const low = Math.min(...pool.map((p) => shareOf(all, p))), rank = (p: Point) => ["high", "medium", "low"].indexOf(p.confidence);
    return { count: pool.length, pick: pool.filter((p) => shareOf(all, p) <= low * 1.005).sort((a, b) => rank(a) - rank(b) || (a.price_usd ?? Infinity) - (b.price_usd ?? Infinity) || cheaper(a, b))[0] };
  };
  const add = (all: Point[], pick: Point, note: string) => {
    const label = all[0].model_display.replace(/\s*\(v\d+\)$/, "");
    const { until, list } = listOf(all, pick);
    const rate = list?.currency === "CNY" ? conventions.usdPerCny : 1;
    const details: SubscriptionDetails = {
      plan: name(pick), feeUsd: pick.price_usd ?? undefined, confidence: pick.confidence, mix: mixOf(pick.workload), dataDate: pick.data_date ?? undefined, ...(pick.preliminary ? { preliminary: pick.preliminary } : {}),
      ...(list ? { listPrice: { cached: list.cached / rate, input: list.input / rate, output: list.output / rate } } : {}), ...(until ? { listUntil: until.until } : {}),
      plans: [...all].sort(cheaper).map((p) => ({ plan: name(p), feeUsd: p.price_usd ?? undefined, usdPerMtok: p.real_usd_per_mtok, confidence: p.confidence, ...(p.preliminary ? { preliminary: p.preliminary } : {}) })),
    };
    const budget = budgetOf(pick.id);
    rows.push({ benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: label, value: pick.real_usd_per_mtok, sourceUrl: budget?.source ?? SITE, note: `${name(pick)}${pick.price_usd ? `, $${pick.price_usd}/month` : ""}; ${pick.confidence} confidence; ${note}${budget ? `; ${budget.note}` : ""}`, details: details as unknown as Record<string, unknown> });
  };
  // Speed tiers and previews ("-fast", "-flashx", "-preview") normalize onto their base model; a
  // price for one must not be shown as the other's, so the label has to survive normalization whole.
  const claim = (all: Point[]) => {
    const n = normalizeLabel(all[0].model_display.replace(/\s*\(v\d+\)$/, ""));
    if (!n.ok || squash(n.modelId) !== squash(PRIORS_IDS[all[0].model] ?? all[0].model) || taken.has(n.modelId)) return false;
    taken.add(n.modelId);
    return true;
  };
  // Every plan that sells the model competes: a lab's own and any reseller's.
  for (const own of byModel.values()) {
    if (!claim(own)) continue;
    const all = [...own, ...resellers(own[0].model)], { pick, count } = best(all, own);
    add(all, pick, `biggest subsidy of ${count} plan${count === 1 ? "" : "s"}`);
  }
  // Models only resellers or harnesses sell.
  for (const all of resold.values()) {
    if (!all.some((p) => p.confidence !== "low") || !claim(all)) continue;
    const { pick, count } = best(all);
    add(all, pick, `biggest subsidy of ${count} reseller plan${count === 1 ? "" : "s"}`);
  }
  const idOf = (r: RawRow) => { if (r.identity) return r.identity.modelId; const n = normalizeLabel(r.modelLabel); return n.ok ? n.modelId : undefined; };
  // Curated figures from published plan allowances replace anything computed for the same model.
  for (const o of SUBSIDY_OVERRIDES) {
    const at = rows.findIndex((r) => idOf(r) === o.modelId);
    if (at >= 0) rows.splice(at, 1);
    rows.push({
      benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: o.label, value: o.ratio, sourceUrl: o.source, note: `${o.plan}, $${o.feeUsd}/month: ${o.note}`,
      ...(o.identity ? { identity: o.identity } : {}),
      details: { plan: o.plan, feeUsd: o.feeUsd, confidence: o.confidence, ratio: o.ratio, ...(o.readings ? { readings: o.readings } : {}), source: o.source, dataDate: o.checked, plans: [] } as unknown as Record<string, unknown>,
    });
  }
  // Models no plan sells yet, assumed to match another model's subsidy. `sameAs` makes the engine use that model's share of API
  // price, so the two stay equal even if their list prices differ; the copied token price and mix give the same share without it.
  for (const a of SUBSIDY_ASSUMPTIONS) {
    const from = rows.find((r) => idOf(r) === a.sameAs);
    if (!from || rows.some((r) => idOf(r) === a.modelId)) continue;
    const row = from.details as unknown as SubscriptionDetails;
    if (!a.plans) {
      const d = row, plan = `${d.plan} (assumed same as ${a.sameAsName})`;
      rows.push({
        benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: a.label, value: from.value, sourceUrl: from.sourceUrl, note: `${plan}${d.feeUsd ? `, $${d.feeUsd}/month` : ""}; ${a.confidence ?? "assumed"}; ${a.note}`,
        // A list price held for a stated period is the other model's own, so it stays behind.
        details: { ...d, ...(d.listUntil ? { listPrice: undefined, listUntil: undefined } : {}), plan, sameAs: a.sameAs, confidence: a.confidence ?? "assumed", ...(a.preliminary ? { preliminary: a.preliminary } : {}), dataDate: a.checked, plans: [] } as unknown as Record<string, unknown>,
      });
      continue;
    }
    // Only the plans that sell this model, from the other model's paid plans (past its free tier). Their token prices ride along so the
    // engine prices this model at the plan a visitor picks, otherwise the one that gives it the most: on a shared rate that is the lowest token price.
    const paid = row.free && row.paid ? row.paid : row, plans = paid.plans.filter((p) => a.plans!.test(p.plan));
    const graded = plans.filter((p) => p.confidence !== "low"), at = [...(graded.length ? graded : plans)].sort((x, y) => x.usdPerMtok - y.usdPerMtok || (x.feeUsd ?? Infinity) - (y.feeUsd ?? Infinity))[0];
    if (!at) continue;
    const plan = `${at.plan} (assumed same as ${a.sameAsName})`;
    const { free: _f, limited: _l, paid: _p, ratio: _r, source: _s, ...rest } = paid as SubscriptionDetails & { value?: number };
    rows.push({
      benchmarkId: SUBSCRIPTION_BENCHMARK, modelLabel: a.label, value: at.usdPerMtok * (a.poolRate ?? 1), sourceUrl: from.sourceUrl, note: `${plan}, $${at.feeUsd}/month; assumed; ${a.note}`,
      details: { ...rest, ...(rest.listUntil ? { listPrice: undefined, listUntil: undefined } : {}), ...(a.listPrice ? { listPrice: a.listPrice } : {}), value: undefined, plan, feeUsd: at.feeUsd, sameAs: a.sameAs, ...(a.poolRate ? { poolRate: a.poolRate } : {}), confidence: a.confidence ?? "assumed", ...(a.preliminary ? { preliminary: a.preliminary } : {}), dataDate: a.checked, plans } as unknown as Record<string, unknown>,
    });
  }
  // What subscribers report getting from a plan joins the model's plans, marked preliminary, and becomes its price when it is the biggest subsidy.
  for (const e of planUsageEstimates()) {
    const at = rows.findIndex((r) => idOf(r) === e.modelId), from = at >= 0 ? rows[at] : undefined, row = from?.details as unknown as SubscriptionDetails | undefined, own = row?.free ? row.paid : row;
    const mix = own?.mix ?? pickMix(conventions.standardTokenMix), listPrice = own?.listPrice ?? e.listPrice, usdPerMtok = e.ratio * blendedApiPrice(listPrice, mix);
    const entry = { plan: e.plan, feeUsd: e.feeUsd, usdPerMtok, confidence: "preliminary", preliminary: e.preliminary };
    const current = own ? own.ratio ?? (from && !row?.free ? from.value : (own as { value?: number }).value ?? 0) / blendedApiPrice(listPrice, mix) : Infinity;
    if (own && !(e.ratio < current)) { own.plans = [...(own.plans ?? []).filter((p) => p.plan !== e.plan), entry].sort((a, b) => a.usdPerMtok - b.usdPerMtok); continue; }
    const details = { ...own, value: undefined, ratio: undefined, sameAs: undefined, poolRate: undefined, readings: undefined, plan: e.plan, feeUsd: e.feeUsd, confidence: "preliminary", mix, listPrice, source: e.source || SITE, dataDate: e.checked, preliminary: e.preliminary, plans: [entry, ...(own?.plans ?? []).filter((p) => p.plan !== e.plan)].sort((a, b) => a.usdPerMtok - b.usdPerMtok) };
    const next: RawRow = { ...(from ?? { modelLabel: e.label }), benchmarkId: SUBSCRIPTION_BENCHMARK, value: row?.free ? from!.value : usdPerMtok, sourceUrl: e.source || SITE, note: `${e.plan}, $${e.feeUsd}/month; preliminary; ${e.preliminary.short} ${e.preliminary.note}`, details: (row?.free ? { ...row, paid: { ...details, value: usdPerMtok } } : details) as unknown as Record<string, unknown> };
    if (at >= 0) rows[at] = next; else rows.push(next);
  }
  return rows;
}

/** A point measured before a plan's allowance changed, priced at the allowance it sells with now. */
export function changed(p: Point): Point {
  const c = PLAN_CHANGES.find((c) => p.id.startsWith(`${c.planId}::`));
  const measured = p.data_date?.split("~").pop();
  if (!c || (c.until && measured && measured >= c.until)) return p;
  return { ...p, plan: c.plan, plan_en: c.plan, real_usd_per_mtok: p.real_usd_per_mtok * c.factor };
}

const LESS_SURE: Record<string, string> = { high: "medium", medium: "low", low: "low" };
/** Adds the PLAN_MULTIPLES rows a model measured on the base plan lacks (or has only at low confidence). Runs after `changed`: these are priced at the allowance sold now. */
export function withMultiples(points: Point[]): Point[] {
  const out = [...points];
  for (const m of PLAN_MULTIPLES) for (const base of points) {
    if (!base.id.startsWith(`${m.base}::`) || base.billing !== "subscription" || base.unmetered || !(base.real_usd_per_mtok > 0) || !base.price_usd) continue;
    if (m.models && !m.models.test(base.id.slice(m.base.length + 2))) continue;
    const model = base.id.slice(m.base.length + 2), id = `${m.planId}::${model}`, confidence = LESS_SURE[base.confidence] ?? "low";
    // Real API Pricing renames a plan's id when its allowance changes (chatgpt_pro_5x became chatgpt_pro_10x on 29 October 2026,
    // already at the doubled allowance), so a measured row is found by the plan it sells as, not only by id. Otherwise the plan is listed twice.
    const at = out.findIndex((p) => p.id === id || (p.id.endsWith(`::${model}`) && (p.plan_en ?? p.plan) === m.plan));
    if (at >= 0 && !(out[at].confidence === "low" && confidence !== "low")) continue;
    const derived: Point = { ...base, id, plan: m.plan, plan_en: m.plan, price_usd: m.feeUsd, confidence, real_usd_per_mtok: base.real_usd_per_mtok * (m.feeUsd / base.price_usd) / m.multiple };
    if (at >= 0) out[at] = derived; else out.push(derived);
  }
  return out;
}

/**
 * BUDGET_PLANS as points: fee ÷ the tokens the budget buys at the seller's rate (its promotional rate until that ends), on the standard workload. Without a `list` price,
 * the model's own lab's (or Artificial Analysis') prices the API side. A plan with an `outputBudget` caps output apart: a million tokens then costs the larger share of either cap.
 */
export function budgetPoints(conventions: Conventions, now = new Date()): Point[] {
  const mix = pickMix(conventions.standardTokenMix);
  const perMtok = (b: (typeof BUDGET_PLANS)[number], r: BudgetRates) => b.outputBudget
    ? b.feeUsd * Math.max(blendedApiPrice({ ...r, output: 0 }, mix) / b.budgetUsd, blendedApiPrice({ input: 0, cached: 0, output: r.output }, mix) / b.outputBudget)
    : b.feeUsd * blendedApiPrice(r, mix) / b.budgetUsd;
  return BUDGET_PLANS.flatMap((b) => b.models.map((m): Point => ({
    id: `${b.planId}::${m.model}`, plan: b.plan, plan_en: b.plan, billing: "subscription", model: m.model, model_display: m.display, vendor: m.vendor, workload: "standard",
    // On the seller's own model its rates are the list price. Another lab's model keeps that lab's.
    list_price: m.list ? { ...m.list, currency: "USD" } : m.vendor === b.channel ? { cached: m.cached ?? m.input * 0.1, input: m.input, output: m.output, currency: "USD" } : null, price_usd: b.feeUsd, confidence: b.confidence, data_date: b.checked, real_usd_per_mtok: perMtok(b, m.promo && now < new Date(m.promo.until) ? m.promo : m),
    ...(m.preliminary ? { preliminary: m.preliminary } : {}),
  })));
}

const pickMix = (m: TokenMix): TokenMix => ({ cache: m.cache, input: m.input, output: m.output });

const source: Source = {
  id: "realapipricing",
  name: "Real API Pricing (subscription token prices)",
  url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const [points, conventions, channels] = await Promise.all([
      ctx.fetchText(`${RAW}/derived/points.json`), ctx.fetchText(`${RAW}/data/conventions.json`), ctx.fetchText(`${RAW}/config/channel-colors.json`),
    ]);
    const json = JSON.parse(points) as Points;
    if (!Array.isArray(json.points) || !json.points.length) throw new Error("Real API Pricing: unexpected points payload");
    const conv = JSON.parse(conventions) as Conventions, notes: string[] = [], raw: Record<string, string> = {};
    // Losing this page costs only its rows: Real API Pricing's own OpenCode Go row stands until it is back.
    let stated: Point[] = [];
    try { const [page, models] = await Promise.all([ctx.fetchText(OPENCODE_GO_DOCS), ctx.fetchJson<{ data?: OpenCodeModel[] }>(OPENCODE_GO_MODELS)]); stated = parseOpenCodeGo(page, models, pickMix(conv.standardTokenMix), new Date().toISOString().slice(0, 10)); raw["opencode-go.html"] = page; raw["opencode-go-models.json"] = JSON.stringify(models); }
    catch (e) { notes.push(`OpenCode Go: ${e instanceof Error ? e.message : e}`); }
    const rows = parseSubscriptions(json, conv, JSON.parse(channels) as Channels, new Date(), stated);
    if (!rows.length) throw new Error("Real API Pricing: no subscription rows");
    return {
      benchmarks: [{
        id: SUBSCRIPTION_BENCHMARK, name: "Subscription token price (USD per 1M tokens)", shortName: "Subscription price", sourceId: this.id, url: REPO, lastUpdated: json.generatedAt,
        description: "Monthly fee ÷ the tokens a subscriber can use in a month on the plan that subsidizes the model most, from Real API Pricing's measured allowances and plans sold as a dollar budget at API rates (Mistral Vibe). A lower bound: it assumes the whole allowance is used. Model-level, no reasoning effort; it powers the subscription cost view.",
        unit: "usd" as const, higherIsBetter: false, category: "cost" as const, proxy: true, eligibleForDefault: false, defaultWeight: 0,
      }],
      rows,
      raw: { "points.json": points, "conventions.json": conventions, "channel-colors.json": channels, ...raw },
      notes: [...notes, `${rows.length} models with a subscription price (first-party plans, reseller fallback, curated overrides), snapshot ${json.generatedAt}`],
    };
  },
};
export default source;
