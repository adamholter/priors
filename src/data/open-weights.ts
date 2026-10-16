import type { Model, Snapshot } from "./types";

/**
 * Whether a model's weights are downloadable, from the most to the least trustworthy evidence:
 *   1. Artificial Analysis's per-model flag (`isOpenWeights`), stored with each variant's source metadata.
 *   2. Flags other sources record (Epoch ECI's accessibility group, Benchmark Heaven), passed in by label.
 *   3. `FAMILY_RULES` below, for families whose status never varies.
 * Anything left stays undefined: unknown is not the same as closed. Open means the weights can be
 * downloaded under any license, including non-commercial ones.
 */
const OPEN = true, CLOSED = false;

/** First match wins, tested against the canonical model id. Only families whose status is the same for every release. */
export const FAMILY_RULES: [RegExp, boolean][] = [
  // Hosted-only variants of otherwise open families, before the family rules.
  [/^qwen-?\d+(\.\d+)?-(max|plus|flash|turbo)/, CLOSED], [/-(max|plus)$/, CLOSED],
  [/^(gpt-oss|gemma|llama|deepseek|glm|kimi|minimax|nemotron|olmo|phi-|mimo|hy-|step-?\d|ling|ring|laguna|granite|smollm|falcon|yi-|internlm|exaone|devstral|mixtral|mistral-(small|nemo|7b)|codestral|magistral-small|qwen)/, OPEN],
  [/^(gpt-|o\d|chatgpt|claude|gemini|grok|muse-(spark|wonder)(?!-open)|command|sonar|nova|mistral-(large|medium)|magistral-medium|composer|swe-\d|hunyuan-t1|ernie)/, CLOSED],
];

export function familyOpenWeights(modelId: string): boolean | undefined {
  for (const [re, v] of FAMILY_RULES) if (re.test(modelId)) return v;
  return undefined;
}

const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? x : undefined);

/** Set `openWeights` (and parameter counts) on every model. `signals` are model ids already resolved from other sources. */
export function applyOpenWeights(snapshot: Snapshot, signals: Map<string, boolean>): { models: Model[]; unknown: string[] } {
  const fromAa = new Map<string, { open?: boolean; paramsB?: number; activeB?: number }>();
  for (const v of snapshot.variants) {
    const md = v.sourceModel?.metadata;
    if (!md) continue;
    const e = fromAa.get(v.modelId) ?? {};
    if (typeof md.isOpenWeights === "boolean") e.open = md.isOpenWeights;
    // AA publishes raw counts in billions (692 = 692B); keep the largest total seen for the model.
    const total = num(md.parameters), active = num(md.activeParams) ?? num(md.inferenceParametersActiveBillions);
    if (total && (!e.paramsB || total > e.paramsB)) e.paramsB = total;
    if (active && (!e.activeB || active > e.activeB)) e.activeB = active;
    fromAa.set(v.modelId, e);
  }
  const unknown: string[] = [];
  const models = snapshot.models.map((m): Model => {
    const aa = fromAa.get(m.id);
    const open = aa?.open ?? signals.get(m.id) ?? familyOpenWeights(m.id);
    if (open === undefined && m.kind === "llm") unknown.push(m.id);
    return { ...m, ...(open !== undefined ? { openWeights: open } : {}), ...(aa?.paramsB ? { paramsB: aa.paramsB } : {}), ...(aa?.activeB ? { activeParamsB: aa.activeB } : {}) };
  });
  return { models, unknown };
}
