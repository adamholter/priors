import type { Effort } from "../../src/data/types";
import { normalizeLabel } from "../../src/data/normalize";

export interface AAModelRecord {
  id?: unknown;
  slug?: unknown;
  name?: unknown;
  shortName?: unknown;
  effort?: unknown;
  creator?: unknown;
  isReasoning?: unknown;
  reasoningTokens?: unknown;
  harness?: unknown;
  [key: string]: unknown;
}

export interface AAIdentity {
  modelId: string;
  modelName: string;
  labId: string;
  effort: Effort;
  variantId: string;
  configuration?: string;
  sourceModelId: string;
  sourceSlug: string;
}

export interface AAIdentityCollision {
  variantId: string;
  sourceModelIds: string[];
  sourceSlugs: string[];
}

const EFFORTS = new Set<Effort>(["none", "minimal", "low", "medium", "high", "xhigh", "max", "default"]);
const EFFORT_ALIASES: Record<string, Effort> = {
  min: "minimal", med: "medium", mid: "medium", hi: "high",
  "x-high": "xhigh", "extra-high": "xhigh", "extra high": "xhigh",
  ultra: "max", maximum: "max",
};

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const slugify = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .replace(/-{2,}/g, "-");

const creatorSlug = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  return text((value as Record<string, unknown>).slug) ?? text((value as Record<string, unknown>).name);
};

const labId = (creator: unknown): string => {
  const slug = slugify(creatorSlug(creator) ?? "other");
  const aliases: Record<string, string> = {
    anthropic: "anthropic", openai: "openai", google: "google", meta: "meta",
    xai: "xai", "x-ai": "xai", deepseek: "deepseek", alibaba: "alibaba",
    qwen: "alibaba", moonshot: "moonshot", moonshotai: "moonshot",
    mistral: "mistral", "z-ai": "zhipu", zai: "zhipu", zhipu: "zhipu",
    minimax: "minimax", xiaomi: "xiaomi", cognition: "cognition",
    tencent: "tencent", cursor: "cursor",
  };
  return aliases[slug] ?? "other";
};

function explicitEffort(value: unknown): Effort | undefined {
  const raw = typeof value === "string"
    ? value
    : value && typeof value === "object"
      ? text((value as Record<string, unknown>).slug) ?? text((value as Record<string, unknown>).name)
      : undefined;
  if (!raw) return undefined;
  const cleaned = raw.toLowerCase().trim();
  if (EFFORTS.has(cleaned as Effort)) return cleaned as Effort;
  return EFFORT_ALIASES[cleaned];
}

function effortFor(record: AAModelRecord, label: string): Effort {
  const shown = explicitEffort(record.effort);
  if (shown) return shown;
  if (/\bnon[ -]?reasoning\b|\bno[ -]?thinking\b/i.test(label) || record.isReasoning === false) return "none";
  const named = label.match(/\b(minimal|low|medium|high|xhigh|x-high|extra[ -]high|max|maximum|ultra)(?:\s+effort)?\b/i)?.[1];
  if (named) return explicitEffort(named)!;
  return "default";
}

/**
 * Resolve one authoritative Artificial Analysis model row without discarding it.
 *
 * Recognizable, uncomplicated releases retain Priors' cross-source model id. AA
 * records with extra configuration or an ambiguous slug retain that base model
 * id but get a source-scoped variant suffix. Unknown releases use an AA-scoped
 * model id. The AA UUID is always returned for audit and supplies the stable
 * fallback discriminator, so two authoritative records never silently collapse.
 */
export function resolveAAIdentity(raw: AAModelRecord, tbl?: AAModelRecord): AAIdentity {
  const record = { ...raw, ...(tbl ?? {}) };
  const sourceModelId = text(record.id) ?? text(raw.id);
  if (!sourceModelId) throw new Error("AA model record is missing its authoritative id");

  const sourceSlug = slugify(text(record.slug) ?? text(raw.slug) ?? `model-${sourceModelId}`);
  const label = text(raw.name) ?? text(record.name) ?? text(raw.shortName) ?? text(record.shortName) ?? sourceSlug;
  const effort = effortFor(record, `${label} ${sourceSlug}`);
  const normalized = normalizeLabel(label, effort === "default" ? undefined : effort);

  const modelId = normalized.ok ? normalized.modelId : `aa-${sourceSlug || slugify(sourceModelId)}`;
  const modelName = normalized.ok ? normalized.modelName : label;
  const resolvedLabId = normalized.ok ? normalized.labId : labId(record.creator ?? raw.creator);

  const canonicalSlug = slugify(modelId);
  const uncomplicatedSlug = sourceSlug === canonicalSlug ||
    (effort !== "default" && effort !== "none" && sourceSlug === `${canonicalSlug}-${effort}`);
  const hasConfiguration = /\b(?:default[ -]?fallback|no[ -]?fallback|without[ -]?fallback|with[ -]?fallback|\d+k\s*(?:token|thinking)|token\s*budget|harness)\b/i.test(`${label} ${sourceSlug}`);

  // Anything beyond the canonical slug/effort pattern remains source-scoped.
  // The readable slug aids audits; the UUID prefix makes uniqueness unconditional.
  const configuration = uncomplicatedSlug && !hasConfiguration
    ? undefined
    : `aa-${sourceSlug}-${slugify(sourceModelId).slice(0, 8)}`;
  const variantId = `${modelId}@${effort}${configuration ? `~${configuration}` : ""}`;

  return {
    modelId, modelName, labId: resolvedLabId, effort, variantId, configuration,
    sourceModelId, sourceSlug,
  };
}

/** Report duplicate final identities before observation deduplication. */
export function findAAIdentityCollisions(identities: AAIdentity[]): AAIdentityCollision[] {
  const grouped = new Map<string, AAIdentity[]>();
  for (const identity of identities) {
    const group = grouped.get(identity.variantId) ?? [];
    group.push(identity);
    grouped.set(identity.variantId, group);
  }
  return [...grouped.entries()]
    .filter(([, group]) => new Set(group.map((item) => item.sourceModelId)).size > 1)
    .map(([variantId, group]) => ({
      variantId,
      sourceModelIds: [...new Set(group.map((item) => item.sourceModelId))],
      sourceSlugs: [...new Set(group.map((item) => item.sourceSlug))],
    }));
}
