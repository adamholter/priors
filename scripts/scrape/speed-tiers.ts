import { normalizeLabel } from "../../src/data/normalize";
import type { ScrapeContext, SpeedTierData, SpeedTierId, SpeedTierPlanRate, SpeedTierRate } from "../../src/data/types";
import { fetchProviderEndpoints } from "./sources/aa";

/**
 * Speed tiers (OpenAI's Flex, Fast and Ultrafast, Claude Opus Fast): prices, measured speeds and how plans bill them.
 *
 * - Artificial Analysis benchmarks a tier as its own endpoint ("GPT-6.1 Sol (max) (Fast)"), so its price and speed compare
 *   directly with the standard endpoint it sits beside. It wins where it has a row.
 * - OpenRouter serves every tier as a first-party endpoint and publishes real-traffic throughput per endpoint. It fills what
 *   Artificial Analysis has not benchmarked, Opus Fast above all. The two can disagree a lot; a ratio is only taken within one source.
 * - OpenAI's Codex docs state how fast each tier spends a plan's allowance, and which plan has Ultrafast.
 * - Anthropic's Claude Code docs state that Fast is billed from usage credits, outside the plan, so it has no plan rate.
 *   Flex is an API tier no plan covers. A tier with no plan rate is billed at API rates.
 */
const SPEED_DOC = "https://learn.chatgpt.com/docs/agent-configuration/speed.md";
const CLAUDE_FAST_DOC = "https://code.claude.com/docs/en/fast-mode";
const OR_MODELS = "https://openrouter.ai/api/v1/models";
const OR_STATS = "https://openrouter.ai/api/frontend/v1/stats";
/** The plan Ultrafast needs, named as `PLAN_MULTIPLES` lists it. */
export const ULTRAFAST_PLAN = "ChatGPT Pro 500";
/** The labs a plan rate or a first-party tier is read for. */
const LABS = ["openai", "anthropic"];
/** A day of hourly throughput, and this many requests in OpenRouter's window, on both sides before a ratio means anything. */
const MIN_HOURS = 24, MIN_REQUESTS = 100;

export interface AaEndpoint {
  label?: string;
  host?: { slug?: string };
  model?: { slug?: string };
  pricing?: { price1mInputTokens?: number | null; price1mOutputTokens?: number | null };
  performance?: { outputSpeed?: number | null; endpointErrorRate?: number | null };
}
const AA_TIER: Record<string, SpeedTierId> = { fast: "fast", ultrafast: "ultrafast", flex: "flex" };
const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
const round = (v: number) => +v.toFixed(3);

/** Tier endpoints on a lab's own API, against the standard endpoint of the same model. `modelIdOf` maps an Artificial Analysis slug to a Priors model; anything it does not know is left out. */
export function parseAaTiers(endpoints: AaEndpoint[], modelIdOf: (slug: string) => string | undefined): SpeedTierRate[] {
  const standard = new Map<string, AaEndpoint>(), out: SpeedTierRate[] = [];
  const key = (e: AaEndpoint) => `${e.host?.slug}|${e.model?.slug}`;
  const tierOf = (e: AaEndpoint) => AA_TIER[/\((fast|ultrafast|flex)\)\s*$/i.exec(e.label ?? "")?.[1].toLowerCase() ?? ""];
  for (const e of endpoints) if (LABS.includes(e.host?.slug ?? "") && !tierOf(e)) standard.set(key(e), e);
  for (const e of endpoints) {
    const tier = tierOf(e), base = standard.get(key(e)), modelId = e.model?.slug ? modelIdOf(e.model.slug) : undefined;
    if (!tier || !base || !modelId) continue;
    const price = e.pricing?.price1mOutputTokens, basePrice = base.pricing?.price1mOutputTokens, speed = e.performance?.outputSpeed, baseSpeed = base.performance?.outputSpeed;
    if (!positive(price) || !positive(basePrice)) continue;
    out.push({
      modelId, tier, priceMultiple: round(price / basePrice),
      ...(positive(speed) && positive(baseSpeed) ? { speedMultiple: round(speed / baseSpeed), speedSource: `Artificial Analysis, ${/\((?:max|xhigh|high|medium|low)\)/i.exec(e.label ?? "")?.[0].slice(1, -1).toLowerCase() ?? "one"} effort` } : {}),
      ...(positive(e.performance?.endpointErrorRate) ? { errorRate: round(e.performance.endpointErrorRate) } : {}),
    });
  }
  return out;
}

export interface OrEndpoint { id: string; provider_slug?: string; service_tier?: string | null; pricing?: { completion?: string }; stats?: { throughput_request_count?: number | null } | null }
export interface OrSeries { data?: { x: string; y: Record<string, number | null> }[] }
const OR_TIER: Record<string, SpeedTierId> = { flex: "flex", fast: "fast", ultrafast: "ultrafast" };
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * One model's tiers from its first-party endpoints on OpenRouter ("openai/fast" against "openai"), by the median of three days
 * of hourly throughput. OpenRouter's own 30-minute medians swing too far between scrapes (Opus Fast read 1.7x and 2.4x the same morning).
 * A side with little traffic has no speed, and neither does a Fast or Ultrafast that reads slower than standard: on real traffic that is
 * a different mix of requests on a thin tier, not the tier. Its price still stands.
 */
export function parseOpenRouterTiers(modelId: string, lab: string, endpoints: OrEndpoint[], throughput: OrSeries): SpeedTierRate[] {
  const own = endpoints.filter((e) => e.provider_slug === lab || e.provider_slug?.startsWith(`${lab}/`));
  const base = own.find((e) => e.provider_slug === lab), basePrice = Number(base?.pricing?.completion);
  if (!base || !positive(basePrice)) return [];
  const speedOf = (e: OrEndpoint) => {
    const xs = (throughput.data ?? []).flatMap((p) => positive(p.y[e.id]) ? [p.y[e.id] as number] : []);
    return xs.length >= MIN_HOURS && (e.stats?.throughput_request_count ?? 0) >= MIN_REQUESTS ? median(xs) : undefined;
  };
  const baseSpeed = speedOf(base), out: SpeedTierRate[] = [];
  for (const e of own) {
    const tier = OR_TIER[e.provider_slug!.split("/")[1] ?? ""], price = Number(e.pricing?.completion);
    if (!tier || !positive(price)) continue;
    const speed = speedOf(e), ratio = speed && baseSpeed ? speed / baseSpeed : undefined;
    out.push({ modelId, tier, priceMultiple: round(price / basePrice), ...(ratio && (tier === "flex" || ratio >= 1) ? { speedMultiple: round(ratio), speedSource: "OpenRouter, real traffic" } : {}) });
  }
  return out;
}

/** Artificial Analysis first, field by field: a tier it prices but has no speed for still takes OpenRouter's speed. */
export function mergeTierRates(aa: SpeedTierRate[], openRouter: SpeedTierRate[]): SpeedTierRate[] {
  const out = new Map<string, SpeedTierRate>();
  for (const r of openRouter) out.set(`${r.modelId}|${r.tier}`, r);
  for (const r of aa) {
    const k = `${r.modelId}|${r.tier}`, other = out.get(k);
    out.set(k, { ...other, ...r, ...(r.speedMultiple ? {} : other?.speedMultiple ? { speedMultiple: other.speedMultiple, speedSource: other.speedSource } : {}) });
  }
  return [...out.values()].sort((a, b) => a.modelId.localeCompare(b.modelId) || a.tier.localeCompare(b.tier));
}

/** OpenAI's allowance rates. Throws when the page no longer says them, so the caller keeps the last ones instead of guessing. */
export function parseOpenAiPlanRates(doc: string): SpeedTierPlanRate[] {
  const text = doc.replace(/\s+/g, " ");
  const fast = /Fast mode uses included subscription limits at ([\d.]+)x/i.exec(text)?.[1], ultra = /Ultrafast uses included subscription limits at ([\d.]+)x/i.exec(text)?.[1];
  if (!positive(Number(fast)) || !positive(Number(ultra))) throw new Error("OpenAI speed doc: allowance rates not found; page changed?");
  if (!/Ultrafast is available in [^.]*Pro \$500/i.test(text)) throw new Error("OpenAI speed doc: Ultrafast no longer names Pro $500; page changed?");
  return [
    { labId: "openai", tier: "fast", usageMultiple: Number(fast), source: SPEED_DOC },
    { labId: "openai", tier: "ultrafast", usageMultiple: Number(ultra), plan: ULTRAFAST_PLAN, source: SPEED_DOC },
  ];
}

/** Whether Anthropic still bills Fast outside the plan. When this stops being true the tier needs a plan rate, so the caller says so. */
export const claudeFastOutsidePlan = (doc: string) => /usage credits only and not included in the subscription rate limits/i.test(doc.replace(/\s+/g, " "));

/** `modelIdOf` maps an Artificial Analysis slug to a Priors model; `previous` is the last snapshot's data, kept for whatever cannot be read this run. */
export async function fetchSpeedTiers(ctx: ScrapeContext, modelIdOf: (slug: string) => string | undefined, known: (modelId: string) => boolean, previous?: SpeedTierData): Promise<{ data: SpeedTierData; raw: Record<string, string> }> {
  const raw: Record<string, string> = {};
  const endpoints = await fetchProviderEndpoints(ctx).catch((e) => { ctx.log(`Artificial Analysis endpoints: ${e instanceof Error ? e.message : e}`); return [] as AaEndpoint[]; });
  raw["aa-tier-endpoints.json"] = JSON.stringify(endpoints.filter((e) => LABS.includes(e.host?.slug ?? "")).map((e) => ({ label: e.label, host: e.host?.slug, model: e.model?.slug, pricing: e.pricing, performance: e.performance })));
  const aa = parseAaTiers(endpoints, modelIdOf);

  const openRouter: SpeedTierRate[] = [];
  try {
    const list = await ctx.fetchJson<{ data: { id: string; name: string; canonical_slug?: string }[] }>(OR_MODELS);
    const targets = list.data.filter((m) => LABS.includes(m.id.split("/")[0]) && !/:|-pro$|-fast$/.test(m.id)).flatMap((m) => {
      const n = normalizeLabel(m.name);
      return n.ok && known(n.modelId) ? [{ modelId: n.modelId, lab: m.id.split("/")[0], permaslug: m.canonical_slug ?? m.id }] : [];
    });
    for (let i = 0; i < targets.length; i += 6) await Promise.all(targets.slice(i, i + 6).map(async (t) => {
      const q = `permaslug=${encodeURIComponent(t.permaslug)}&variant=standard`;
      const eps = await ctx.fetchJson<{ data?: OrEndpoint[] }>(`${OR_STATS}/endpoint?${q}`).catch(() => undefined);
      if (!eps?.data?.some((e) => OR_TIER[e.provider_slug?.split("/")[1] ?? ""])) return;
      const series = await ctx.fetchJson<OrSeries>(`${OR_STATS}/throughput-comparison?perfWorkload=text_generation&${q}&timeRange=3d`).catch(() => ({}) as OrSeries);
      openRouter.push(...parseOpenRouterTiers(t.modelId, t.lab, eps.data, series));
    }));
  } catch (e) { ctx.log(`OpenRouter tiers: ${e instanceof Error ? e.message : e}`); }
  raw["openrouter-tiers.json"] = JSON.stringify(openRouter);

  let planRates = previous?.planRates ?? [];
  try {
    const doc = await ctx.fetchText(SPEED_DOC);
    raw["openai-speed.md"] = doc;
    planRates = parseOpenAiPlanRates(doc);
  } catch (e) { ctx.log(`${e instanceof Error ? e.message : e}; kept the last plan rates`); }
  try {
    if (!claudeFastOutsidePlan(await ctx.fetchText(CLAUDE_FAST_DOC))) ctx.log("Claude Code docs no longer say Fast sits outside the plan: check it, it may need a plan rate");
  } catch (e) { ctx.log(`Claude fast mode doc: ${e instanceof Error ? e.message : e}`); }

  const fresh = mergeTierRates(aa, openRouter), freshKeys = new Set(fresh.map((r) => `${r.modelId}|${r.tier}`));
  // A source down this run costs nothing: rows it would have refreshed carry over.
  const rates = !aa.length || !openRouter.length ? [...fresh, ...(previous?.rates ?? []).filter((r) => !freshKeys.has(`${r.modelId}|${r.tier}`))] : fresh;
  if (!rates.length) throw new Error("no speed tiers read from any source");
  return { data: { rates, planRates }, raw };
}
