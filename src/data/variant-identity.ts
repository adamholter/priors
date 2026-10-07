import { normalizeLabel } from "./normalize";
import type { Effort, Variant } from "./types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// Publishers use both "Qwen 3.8" and "Qwen3.8". Only the brand/version separator
// is optional; separators between version numbers and parameter counts stay intact.
const spellings = (s: string) => [...new Set([slug(s), slug(s).replace(/^([a-z]+)-(?=\d)/, "$1")])];

/** Source IDs describe provenance. Only an explicit extra configuration changes identity.
 * Require the entire source key to match, rather than accepting a recognizable prefix:
 * a dated release, tool harness, budget or unknown suffix must not disappear in normalization.
 */
export function isBaselineVariant(modelId: string, effort: Effort, sourceKey: string, label: string): boolean {
  const n = normalizeLabel(label, effort);
  if (!n.ok || n.modelId !== modelId) return false;
  if (/\b(?:non[ -]?thinking|non[ -]?reasoning|no[ -]?thinking)\b/i.test(label) && effort !== "none") return false;
  const bases = [...new Set([...spellings(modelId), ...spellings(n.modelName)])];
  const key = slug(sourceKey.split("/").at(-1) ?? sourceKey);
  const effortSuffixes = effort === "none"
    ? ["none", "non-reasoning", "nonthinking", "non-thinking", "no-thinking"]
    : [effort, ...(effort === "xhigh" ? ["x-high", "extra-high"] : [])];
  const keys = bases.flatMap(base => [base, ...effortSuffixes.map(e => `${base}-${e}`)]);
  if (!keys.includes(key) && !keys.some(k => key === `${k}-default-fallback`)) return false;

  // Even with a plain key, the display name may specify an evaluated configuration.
  // Remove only documented mode words after the full release name has matched.
  const identityLabel = label.replace(/\([^)]*\bbased\s+on\b[^)]*\)|\[[^\]]*\bbased\s+on\b[^\]]*\]/gi, " ");
  const name = slug(identityLabel.split("/").at(-1) ?? label);
  const prefixes = bases.sort((a, b) => b.length - a.length);
  const prefix = prefixes.find(p => name === p || name.startsWith(`${p}-`));
  if (!prefix) return false;
  const remainder = name.slice(prefix.length).replace(/^-/, "");
  return !remainder.replace(/(?:^|-)(?:default-fallback|adaptive-reasoning|extra-high|x-high|non-reasoning|non-thinking|no-thinking|nonthinking|minimal|low|medium|high|xhigh|max|maximum|ultra|default|none|thinking|reasoning|adaptive|effort)(?=-|$)/g, "").replace(/-/g, "");
}

/** Backwards compatibility for saved links created before source aliases were merged. */
export function matchesVariantId(variant: Pick<Variant, "id" | "aliases">, id: string): boolean {
  return variant.id === id || !!variant.aliases?.includes(id);
}
