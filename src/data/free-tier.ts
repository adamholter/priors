import type { Model, Observation, Snapshot } from "./types";
import { SUBSCRIPTION_BENCHMARK } from "./subscription";

/**
 * Models a provider currently serves at no charge. They price at ratio 0 in the subscription cost
 * view, so the index does not keep charging for a model that is free today. Two live lists feed it:
 * OpenCode Zen (`-free` model ids) and OpenRouter (`:free` variants). Both lists are noisy, so an
 * entry only counts when it names a model the index already ranks as an LLM, by exact name.
 */
export interface FreeTierEntry {
  provider: "opencode" | "openrouter";
  /** The provider's id for the model. */
  slug: string;
  /** Name used to find the model in the index. */
  name: string;
  plan: string;
  source: string;
  note?: string;
}

export const OPENCODE_PLAN = "OpenCode Zen free tier";
export const OPENROUTER_PLAN = "OpenRouter free tier";
const ZEN_URL = "https://opencode.ai/docs/zen/";
const OPENROUTER_URL = "https://openrouter.ai/models?max_price=0";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Lookup key for a name or slug: lowercase alphanumerics, with no reasoning-mode suffix. */
export function freeKey(s: string): string {
  return squash(s.replace(/\((non-)?reasoning\)/gi, ""));
}

/** OpenCode Zen model ids that end in `-free`. A contributor tier is free in exchange for sharing prompts, and is noted as such. */
export function parseZenFree(ids: string[]): FreeTierEntry[] {
  const out: FreeTierEntry[] = [];
  for (const id of ids) {
    if (!id.endsWith("-free")) continue;
    const contributor = id.endsWith("-contributor-free");
    const base = id.replace(/-(contributor-)?free$/, "");
    if (!base) continue;
    out.push({
      provider: "opencode", slug: id, name: base, plan: OPENCODE_PLAN, source: ZEN_URL,
      ...(contributor ? { note: "Free through Zen's contributor program, which shares your prompts with the lab." } : {}),
    });
  }
  return out;
}

export interface OpenRouterListing {
  id: string;
  name?: string;
  pricing?: Record<string, unknown>;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

/** Words in an id or name that mark something other than a general chat model. */
const NOT_A_CHAT_MODEL = /safety|guard|moderat|embed|rerank|classif|whisper|transcri|image|video|audio|music|lyria/i;

/**
 * OpenRouter `:free` variants that really are free text models. OpenRouter prices some image, audio
 * and router entries at 0 in odd ways, so the output must be text only, every price must be zero,
 * and routers and moderation or embedding models are dropped.
 */
export function parseOpenRouterFree(list: OpenRouterListing[]): FreeTierEntry[] {
  const out: FreeTierEntry[] = [];
  for (const m of list) {
    if (!m.id.endsWith(":free") || m.id.startsWith("openrouter/")) continue;
    const outputs = m.architecture?.output_modalities;
    if (!Array.isArray(outputs) || outputs.length !== 1 || outputs[0] !== "text") continue;
    if (!(m.architecture?.input_modalities ?? []).includes("text")) continue;
    const prices = Object.values(m.pricing ?? {});
    if (!prices.length || !prices.every((p) => Number.isFinite(Number(p)) && Number(p) === 0)) continue;
    const slug = m.id.replace(/:free$/, "");
    if (NOT_A_CHAT_MODEL.test(slug)) continue;
    out.push({ provider: "openrouter", slug: m.id, name: slug.split("/").pop()!, plan: OPENROUTER_PLAN, source: OPENROUTER_URL });
  }
  return out;
}

const isLlm = (m: Model) => !m.kind || m.kind === "llm";

/** The ranked models a free entry names. An entry matches by exact key against a model's name or id, ignoring a leading `aa-`. */
export function modelsForFree(entry: FreeTierEntry, models: Model[]): Model[] {
  const key = freeKey(entry.name);
  if (!key) return [];
  return models.filter((m) => isLlm(m) && (freeKey(m.name) === key || freeKey(m.id.replace(/^aa-/, "")) === key));
}

/** Adds a ratio 0 subscription row for every ranked model that is free, replacing any computed one. Returns the model ids made free. */
export function applyFreeTiers(snapshot: Snapshot, entries: FreeTierEntry[], date: string): string[] {
  const free = new Map<string, FreeTierEntry[]>();
  for (const e of entries) for (const m of modelsForFree(e, snapshot.models)) (free.get(m.id) ?? free.set(m.id, []).get(m.id)!).push(e);
  if (!free.size) return [];
  const variantsOf = (modelId: string) => snapshot.variants.filter((v) => v.modelId === modelId);
  const variantModel = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const ORDER = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
  const kept = snapshot.observations.filter((o) => o.benchmarkId !== SUBSCRIPTION_BENCHMARK || !free.has(variantModel.get(o.variantId) ?? o.variantId.split("@")[0]));
  const added: Observation[] = [];
  for (const [modelId, es] of free) {
    const variants = variantsOf(modelId);
    if (!variants.length) continue;
    const variant = [...variants].sort((a, b) => ORDER.indexOf(b.effort) - ORDER.indexOf(a.effort))[0];
    const pick = es.find((e) => e.provider === "opencode") ?? es[0];
    const also = es.filter((e) => e !== pick).map((e) => e.plan);
    const note = [`${pick.plan}: ${pick.slug} is listed at no charge`, ...(also.length ? [`also free on ${also.join(", ")}`] : []), pick.note].filter(Boolean).join("; ");
    added.push({
      benchmarkId: SUBSCRIPTION_BENCHMARK, variantId: variant.id, value: 0, observedAt: date, sourceUrl: pick.source, note,
      details: { plan: pick.plan, feeUsd: 0, confidence: "high", ratio: 0, source: pick.source, dataDate: date, free: true, plans: [] },
    });
  }
  snapshot.observations = [...kept, ...added];
  return added.map((o) => variantModel.get(o.variantId)!);
}

/** Free rows from an earlier snapshot, for when today's lists could not be fetched. Only models still in the index are kept. */
export function carriedFreeTiers(previous: Snapshot, snapshot: Snapshot): Observation[] {
  const modelIds = new Set(snapshot.models.map((m) => m.id));
  const variants = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  return previous.observations.filter((o) => o.benchmarkId === SUBSCRIPTION_BENCHMARK && (o.details as { free?: boolean } | undefined)?.free
    && modelIds.has(variants.get(o.variantId) ?? "")).map((o) => ({ ...o, note: [o.note, `carried from ${previous.date}`].filter(Boolean).join("; ") }));
}
