import type { Snapshot } from "../data/types";
import { chartVariantMode, computeIndex, selectVariants, type IndexConfig } from "../engine";
import { decodeIndex } from "../lib/url";

/** Earlier hardcoded defaults — a stored lineup equal to one of these is not a user choice. */
export const LEGACY_DEFAULTS = [
  ["claude-opus-5.5", "claude-fable-5.1", "gpt-6-astra", "claude-opus-5", "claude-fable-5", "muse-spark-1.3", "gpt-6-sol", "grok-4.7", "mimo-v2.6-pro", "qwen-3.8-max", "glm-5.3", "grok-4.6", "kimi-k3", "gpt-5.6-terra", "glm-5.3-flash", "gemini-3.8-flash"],
  ["claude-opus-5.5", "claude-fable-5.1", "gpt-6-astra", "claude-opus-5", "claude-fable-5", "muse-spark-1.3", "gpt-6-sol", "grok-4.7", "mimo-v2.6-pro", "qwen-3.8-max", "glm-5.3", "grok-4.6", "kimi-k3", "gpt-5.6-terra", "glm-5.3-flash", "gemini-3.8-flash", "deepseek-v4.1-flash", "claude-sonnet-5"],
  ["claude-opus-5.5", "gpt-6-astra", "claude-fable-5.1", "claude-fable-5", "gpt-6-sol", "claude-opus-5", "grok-4.7", "gpt-6-luna", "gemini-3.8-flash", "glm-5.3", "gpt-5.6-terra", "grok-4.6", "gemini-3.7-flash", "claude-sonnet-5"],
  ["claude-opus-5.5", "gpt-6-astra", "claude-fable-5.1", "gpt-6-sol", "claude-fable-5", "claude-opus-5", "gpt-6-luna", "grok-4.7", "gemini-3.8-flash", "glm-5.3", "gpt-5.6-terra", "grok-4.6", "gemini-3.7-flash", "claude-sonnet-5"],
  ["claude-opus-5.5", "gpt-6-astra", "claude-fable-5.1", "claude-fable-5", "gpt-6-sol", "claude-opus-5", "grok-4.7", "gpt-6-luna", "glm-5.3", "gpt-5.6-terra", "gemini-3.8-flash", "grok-4.6", "gemini-3.7-flash", "claude-sonnet-5"],
];

/**
 * The mix that defines the default lineup — the owner's "My priors" index. New models join the
 * default automatically when they climb into its top ranks; nobody edits a list by hand.
 */
export const DEFAULT_PRIORS_MIX: IndexConfig = decodeIndex(
  "My priors|aa-artificial-analysis-long-context-reasoning:55.4,aa-automationbench-aa:55.4,aa-briefcase:21.6,aa-gdp-pdf:100,aa-omniscience:59.9,aa-omniscience-non-hallucination:9.5,aa-scicode:87.8,aa-terminalbench-v4-0:60.8|strict=50|bars=best|est=0|var=best|effort=strict|focus=capabilities",
  "default-priors",
)!;

const lineupCache = new WeakMap<Snapshot, string[]>();
/** The default onboarding lineup: the first `n` models under DEFAULT_PRIORS_MIX on this snapshot. */
export function defaultLineup(snapshot: Snapshot, n = 14): string[] {
  let l = lineupCache.get(snapshot);
  if (!l) {
    const r = computeIndex(snapshot, { ...DEFAULT_PRIORS_MIX, variants: "all" });
    l = selectVariants(r.ranked, chartVariantMode(DEFAULT_PRIORS_MIX, "ranking")).map((x) => x.model.id);
    lineupCache.set(snapshot, l);
  }
  return l.slice(0, n);
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
