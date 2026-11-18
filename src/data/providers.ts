import { columnsOf, observationsOf } from "./columns";
import type { Snapshot } from "./types";

/** What OpenRouter lists for one provider of a model. Prices are USD per 1M tokens. */
export interface OpenRouterOffer { provider: string; input: number; output: number; context?: number; uptime?: number }
/** What Artificial Analysis measured for one provider of a model. `speed` is output tokens per second, `ttft` seconds. */
export interface AAProviderRow { provider: string; input?: number; output?: number; speed?: number; ttft?: number; errorRate?: number; context?: number }
export type ModelProvider = { provider: string } & Partial<Omit<OpenRouterOffer, "provider">> & Partial<Omit<AAProviderRow, "provider">>;
export interface ModelProviders { providers: ModelProvider[]; openRouterUrl?: string; aaUrl?: string }

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown) => { const n = typeof v === "string" ? Number(v) : v; return typeof n === "number" && Number.isFinite(n) ? n : undefined; };
const sig = (v: number) => +v.toPrecision(4);
const blended = (p: { input?: number; output?: number }) => p.input != null && p.output != null ? (3 * p.input + p.output) / 4 : Infinity;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Cheap tiers that can be interrupted or queued: a provider's price is its regular endpoint's when it has one. */
const DISCOUNT_TAG = /\/(flex|spot|batch)$/;

/** OpenRouter's endpoints for a model, one per provider: the cheapest regular endpoint. */
export function openRouterOffers(endpoints: Json[]): OpenRouterOffer[] {
  const best = new Map<string, OpenRouterOffer & { discount: boolean }>();
  for (const e of endpoints) {
    const provider = e.provider_name, input = num(e.pricing?.prompt), output = num(e.pricing?.completion);
    if (typeof provider !== "string" || !provider || input == null || output == null || input < 0 || output < 0) continue;
    const context = num(e.context_length), uptime = num(e.uptime_last_1d) ?? num(e.uptime_last_30m);
    const row = { provider, input: sig(input * 1e6), output: sig(output * 1e6), ...(context ? { context } : {}), ...(uptime != null ? { uptime: +uptime.toFixed(2) } : {}), discount: DISCOUNT_TAG.test(String(e.tag ?? "")) };
    const had = best.get(provider);
    if (!had || (had.discount && !row.discount) || (had.discount === row.discount && blended(row) < blended(had))) best.set(provider, row);
  }
  return [...best.values()].map(({ discount: _discount, ...row }) => { void _discount; return row; }).sort((a, b) => blended(a) - blended(b) || a.provider.localeCompare(b.provider));
}

/** Artificial Analysis' endpoint table by model release, one row per provider: its standard tier, medians across the efforts it serves. */
export function aaProviderRows(endpoints: Json[]): Map<string, AAProviderRow[]> {
  const grouped = new Map<string, Map<string, Json[]>>();
  for (const e of endpoints) {
    const slug = e.model?.release?.slug, provider = e.host?.name;
    if (typeof slug !== "string" || typeof provider !== "string") continue;
    const hosts = grouped.get(slug) ?? grouped.set(slug, new Map()).get(slug)!;
    (hosts.get(provider) ?? hosts.set(provider, []).get(provider)!).push(e);
  }
  const out = new Map<string, AAProviderRow[]>();
  for (const [slug, hosts] of grouped) out.set(slug, [...hosts].map(([provider, all]) => {
    const standard = all.filter((e) => !/\bfast\b/i.test(String(e.label ?? ""))), rows = standard.length ? standard : all;
    const mid = (of: (e: Json) => unknown) => { const xs = rows.map((e) => num(of(e))).filter((v): v is number => v != null); return xs.length ? median(xs) : undefined; };
    const input = mid((e) => e.pricing?.price1mInputTokens), output = mid((e) => e.pricing?.price1mOutputTokens), speed = mid((e) => e.performance?.outputSpeed), ttft = mid((e) => e.performance?.timeToFirstToken), errorRate = mid((e) => e.performance?.endpointErrorRate), context = mid((e) => e.features?.contextWindowTokens);
    return { provider, ...(input != null ? { input: sig(input) } : {}), ...(output != null ? { output: sig(output) } : {}), ...(speed ? { speed: +speed.toFixed(1) } : {}), ...(ttft ? { ttft: +ttft.toFixed(2) } : {}), ...(errorRate != null ? { errorRate: +errorRate.toFixed(4) } : {}), ...(context ? { context } : {}) };
  }));
  return out;
}

/** The two sources name some companies differently. */
const ALIASES: Record<string, string> = { togetherai: "together", alibabacloud: "alibaba", friendliai: "friendli", gmicloud: "gmi", microsoftazure: "azure", moonshotai: "kimi", spacexai: "xai", googleaistudio: "google", googlevertex: "google" };
export const providerKey = (name: string) => { const k = name.toLowerCase().replace(/[^a-z0-9]/g, ""); return ALIASES[k] ?? k; };

/** One row per company serving the model: OpenRouter's price and uptime with Artificial Analysis' measured speed beside it, cheapest first. */
export function mergeProviders(offers: OpenRouterOffer[], measured: AAProviderRow[]): ModelProvider[] {
  const aa = new Map(measured.map((r) => [providerKey(r.provider), r])), used = new Set<string>();
  const rows: ModelProvider[] = offers.map((o) => { const k = providerKey(o.provider), m = used.has(k) ? undefined : aa.get(k); if (m) used.add(k); return { ...m, ...o }; });
  for (const [k, m] of aa) if (!used.has(k)) rows.push(m);
  return rows.sort((a, b) => blended(a) - blended(b) || a.provider.localeCompare(b.provider));
}

const indexes = new WeakMap<Snapshot, Map<string, { offers: OpenRouterOffer[]; measured: AAProviderRow[]; openRouterUrl?: string; aaUrl?: string }>>();
function providerIndex(snapshot: Snapshot) {
  let index = indexes.get(snapshot);
  if (index) return index;
  index = new Map();
  const modelOf = columnsOf(snapshot).modelOf, at = (id: string) => { const m = modelOf.get(id) ?? id.split("@")[0]; return index!.get(m) ?? index!.set(m, { offers: [], measured: [] }).get(m)!; };
  for (const o of observationsOf(snapshot, "openrouter-providers")) { const list = o.details?.endpoints as OpenRouterOffer[] | undefined; if (list?.length) Object.assign(at(o.variantId), { offers: list, openRouterUrl: o.sourceUrl }); }
  for (const o of observationsOf(snapshot, "aa-output-speed")) { const list = o.details?.providers as AAProviderRow[] | undefined; const m = list?.length ? at(o.variantId) : undefined; if (m && !m.measured.length) Object.assign(m, { measured: list, aaUrl: `${o.sourceUrl}/providers` }); }
  indexes.set(snapshot, index);
  return index;
}

export function modelProviders(snapshot: Snapshot, modelId: string): ModelProviders {
  const m = providerIndex(snapshot).get(modelId);
  return m ? { providers: mergeProviders(m.offers, m.measured), ...(m.offers.length ? { openRouterUrl: m.openRouterUrl } : {}), ...(m.measured.length ? { aaUrl: m.aaUrl } : {}) } : { providers: [] };
}
