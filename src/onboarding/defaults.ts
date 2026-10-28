import type { Snapshot } from "../data/types";
import { computeIndex, selectVariants, type IndexConfig } from "../engine";
import { decodeIndex } from "../lib/url";
import { aaComponentWeights, latestAAIndex } from "../data/aa-index";

export const PRIORS_MIX_COOKIE = "priors:mix";

/** Earlier hardcoded defaults — a stored lineup equal to one of these is not a user choice. */
export const LEGACY_DEFAULTS = [
  ["claude-opus-5.5", "claude-fable-5.1", "gpt-6-astra", "claude-opus-5", "claude-fable-5", "muse-spark-1.3", "gpt-6-sol", "grok-4.7", "mimo-v2.6-pro", "qwen-3.8-max", "glm-5.3", "grok-4.6", "kimi-k3", "gpt-5.6-terra", "glm-5.3-flash", "gemini-3.8-flash"],
  ["claude-opus-5.5", "claude-fable-5.1", "gpt-6-astra", "claude-opus-5", "claude-fable-5", "muse-spark-1.3", "gpt-6-sol", "grok-4.7", "mimo-v2.6-pro", "qwen-3.8-max", "glm-5.3", "grok-4.6", "kimi-k3", "gpt-5.6-terra", "glm-5.3-flash", "gemini-3.8-flash", "deepseek-v4.1-flash", "claude-sonnet-5"],
  ["claude-opus-5.5", "gpt-6-astra", "claude-fable-5.1", "claude-fable-5", "gpt-6-sol", "claude-opus-5", "grok-4.7", "gpt-6-luna", "gemini-3.8-flash", "glm-5.3", "gpt-5.6-terra", "grok-4.6", "gemini-3.7-flash", "claude-sonnet-5"],
  ["claude-opus-5.5", "gpt-6-astra", "claude-fable-5.1", "gpt-6-sol", "claude-fable-5", "claude-opus-5", "gpt-6-luna", "grok-4.7", "gemini-3.8-flash", "glm-5.3", "gpt-5.6-terra", "grok-4.6", "gemini-3.7-flash", "claude-sonnet-5"],
  ["claude-opus-5.5", "gpt-6-astra", "claude-fable-5.1", "claude-fable-5", "gpt-6-sol", "claude-opus-5", "grok-4.7", "gpt-6-luna", "glm-5.3", "gpt-5.6-terra", "gemini-3.8-flash", "grok-4.6", "gemini-3.7-flash", "claude-sonnet-5"],
];

/** First-time ranking uses Artificial Analysis' index, not a custom mix. Settings only: the weights come from the snapshot (`defaultPriorsMix`). */
export const DEFAULT_PRIORS_MIX: IndexConfig = decodeIndex(
  "Artificial Analysis|aa-intelligence-index-v5.0:100|strict=50|bars=best|est=0|var=best|effort=strict|focus=capabilities",
  "default-priors",
)!;

/**
 * Artificial Analysis' Intelligence Index, built from its evaluations at AA's own weights so each model's strengths
 * show evaluation by evaluation. Every component is required (strictness 100, nothing estimated), so it ranks exactly
 * the models AA scores. Falls back to the composite itself when the snapshot lacks the parts.
 */
export function defaultPriorsMix(snapshot: Snapshot): IndexConfig {
  const parts = aaComponentWeights(snapshot);
  if (parts) return { ...DEFAULT_PRIORS_MIX, weights: parts, strictness: 100 };
  const latest = latestAAIndex(snapshot);
  return { ...DEFAULT_PRIORS_MIX, weights: latest ? { [latest.id]: 100 } : {} };
}

const lineupCache = new WeakMap<Snapshot, string[]>();
/** Top n distinct models, using the saved mix's eligibility and strictness unchanged. */
export function defaultLineup(snapshot: Snapshot, n = 16, mix?: IndexConfig): string[] {
  if (mix) return selectVariants(computeIndex(snapshot, { ...mix, variants: "all" }).ranked, "best").slice(0, n).map(x => x.model.id);
  let lineup = lineupCache.get(snapshot);
  if (!lineup) {
    lineup = selectVariants(computeIndex(snapshot, { ...defaultPriorsMix(snapshot), variants: "all" }).ranked, "best").map(x => x.model.id);
    lineupCache.set(snapshot, lineup);
  }
  return lineup.slice(0, n);
}

/** A completed fit is a mix, never a frozen list of model IDs. */
export function savedMix(raw: string | undefined, snapshot: Snapshot): IndexConfig | null {
  if (!raw || raw.length > 2048) return null;
  try {
    const decoded = decodeIndex(decodeURIComponent(raw), "saved-priors");
    if (!decoded) return null;
    const known = new Set(snapshot.benchmarks.map((b) => b.id));
    const weights = Object.fromEntries(Object.entries(decoded.weights).filter(([id, weight]) => known.has(id) && weight > 0));
    if (!Object.keys(weights).length || Object.keys(weights).length > 20) return null;
    return { ...decoded, weights, required: decoded.required.filter((id) => known.has(id)), onlyModels: undefined, excludeModels: undefined };
  } catch { return null; }
}

/**
 * Decodes `priors:lineup` storage. v2 payloads (`{ v: 2, lineup }`) are user edits and always
 * restore; a legacy bare array restores only if it isn't an untouched earlier default.
 */
export function savedLineup(raw: string | null, isKnown: (id: string) => boolean): string[] | null {
  try {
    const parsed = JSON.parse(raw ?? "null") as { v?: number; lineup?: unknown } | string[] | null;
    if (!parsed) return null;
    const lineup = Array.isArray(parsed) ? parsed : parsed.v === 2 && Array.isArray(parsed.lineup) ? parsed.lineup.filter((x): x is string => typeof x === "string") : null;
    if (!lineup) return null;
    if (Array.isArray(parsed) && LEGACY_DEFAULTS.some((d) => d.join(",") === lineup.join(","))) return null;
    const kept = lineup.filter(isKnown);
    return kept.length >= 2 ? kept : null;
  } catch { return null; }
}
