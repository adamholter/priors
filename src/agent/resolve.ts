/** Name resolution for the assistant: loose model and benchmark names to snapshot ids. */
import type { Snapshot } from "../data/types";
import { EFFORT_ORDER } from "../data/types";

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9.]+/g, " ").trim();
/**
 * A model by id, name or alias, then by partial name. A partial name ("Gemini", "Opus") means the
 * family's best-ranked model when `rankOf` is given (the user's ranking), else the closest name.
 */
export function resolveModel(snapshot: Snapshot, name: string, rankOf?: Map<string, number>): string | null {
  const n = norm(name);
  if (!n) return null;
  const llms = snapshot.models.filter((m) => m.kind === "llm");
  const exact = llms.find((m) => m.id === name) ?? llms.find((m) => norm(m.name) === n) ?? llms.find((m) => norm(m.id) === n) ?? llms.find((m) => m.aliases?.some((a) => norm(a) === n));
  if (exact) return exact.id;
  const rank = (id: string) => rankOf?.get(id) ?? Infinity;
  return llms.filter((m) => norm(m.name).includes(n) || n.includes(norm(m.name)))
    .sort((a, b) => rank(a.id) - rank(b.id) || Math.abs(a.name.length - n.length) - Math.abs(b.name.length - n.length))[0]?.id ?? null;
}
/**
 * A benchmark by id or name, then by partial name. A partial name prefers the user's mix, then the
 * newest version of a family ("DeepSWE" is DeepSWE v1.1, not v1), then the shortest name.
 */
export function resolveBenchmark(snapshot: Snapshot, name: string, inMix?: Record<string, number>): string | null {
  const n = norm(name);
  const b = snapshot.benchmarks;
  const exact = b.find((x) => x.id === name) ?? b.find((x) => norm(x.name) === n || norm(x.shortName ?? "") === n || norm(x.id) === n);
  if (exact) return exact.id;
  const mixed = (id: string) => (inMix?.[id] ? 1 : 0);
  const family = (x: string, y: string) => norm(x).startsWith(norm(y)) || norm(y).startsWith(norm(x));
  return b.filter((x) => norm(x.name).includes(n) || norm(x.shortName ?? "").includes(n) || norm(x.id).includes(n))
    .sort((x, y) => mixed(y.id) - mixed(x.id) || (family(x.name, y.name) ? y.name.localeCompare(x.name, undefined, { numeric: true }) : x.name.length - y.name.length))[0]?.id ?? null;
}


const EFFORT_WORDS: Record<string, string> = { "extra high": "xhigh", "x-high": "xhigh", "x high": "xhigh", xhigh: "xhigh", maximum: "max", max: "max", high: "high", medium: "medium", med: "medium", low: "low", minimal: "minimal", none: "none", "no reasoning": "none", default: "default" };

/**
 * A model name that may carry an effort ("Opus 5.5 max", "GPT-6 Sol at extra high"): the model id and,
 * when one was named and exists, the variant id. An effort the model doesn't have is reported, not guessed.
 */
export function resolveVariant(snapshot: Snapshot, name: string, rankOf?: Map<string, number>): { modelId: string; variantId?: string; missingEffort?: string } | null {
  const n = norm(name).replace(/\b(at|on|reasoning|effort)\b/g, " ").replace(/\s+/g, " ").trim();
  const word = Object.keys(EFFORT_WORDS).sort((a, b) => b.length - a.length).find((w) => new RegExp(`(^|\\s)${w}$`).test(n));
  const modelId = resolveModel(snapshot, word ? n.slice(0, -word.length).trim() : n, rankOf) ?? resolveModel(snapshot, name, rankOf);
  if (!modelId) return null;
  if (!word) return { modelId };
  const effort = EFFORT_WORDS[word], variant = snapshot.variants.find((v) => v.modelId === modelId && v.effort === effort);
  return variant ? { modelId, variantId: variant.id } : { modelId, missingEffort: effort };
}

export const EFFORTS = [...EFFORT_ORDER, "default"] as const;

/** Product names people use for a lab's models. */
const LAB_WORDS: Record<string, string> = { claude: "anthropic", gpt: "openai", chatgpt: "openai", codex: "openai", gemini: "google", grok: "xai", llama: "meta", muse: "meta", qwen: "alibaba", kimi: "moonshot", glm: "zhipu", mimo: "xiaomi" };
/** A lab by name, id or product family ("Claude" means Anthropic). */
export function resolveLab(snapshot: Snapshot, name: string): string | null {
  const n = norm(name).replace(/\b(models?|labs?)\b/g, "").trim();
  return snapshot.labs.find((l) => l.id === n || norm(l.name) === n)?.id ?? LAB_WORDS[n] ?? null;
}
