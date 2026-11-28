import { LABS } from "./normalize";
import { labKey, labLogo } from "./lab-logos";
import type { Lab, Snapshot } from "./types";

/** The grey a lab gets when nobody gave it a color. */
const NO_COLOR = "#A3A39B";
const known = new Map(LABS.map((l) => [l.id, l]));

/** A snapshot lab with the name and chart color the code knows. Only a lab with no color of its own takes LABS' color; a named lab keeps its name. */
export function labIdentity(lab: Lab): Lab {
  const own = known.get(lab.id);
  if (own) return { ...lab, name: lab.name === lab.id || !lab.name ? own.name : lab.name, color: !lab.color || lab.color.toUpperCase() === NO_COLOR ? own.color : lab.color };
  const logo = lab.name === lab.id ? labLogo(lab.id) : undefined;
  return logo ? { ...lab, name: logo.name } : lab;
}

/**
 * Artificial Analysis names each model's creator, and two of its creators are the platform that sells the model, not the lab:
 * Nova is Amazon's (AA files it under AWS) and Phi is Microsoft's (under Azure). Every other creator slug is a lab id or one of its spellings.
 */
const CREATOR_LAB: Record<string, string> = { aws: "amazon", azure: "microsoft" };

/** The lab id for an Artificial Analysis creator slug ("liquidai", "ai21-labs", "kwaikat"), or undefined when it is not a lab we list. A provider or plan seller is never a model's lab. */
export function aaCreatorLab(slug: unknown): string | undefined {
  if (typeof slug !== "string" || !slug.trim()) return undefined;
  const key = labKey(slug), id = CREATOR_LAB[key] ?? labLogo(key)?.id, entry = labLogo(id);
  return entry && !entry.kind && entry.id !== "other" ? entry.id : undefined;
}

/** The lab Artificial Analysis credits each model to, from any of its variants' sources (model id to lab id). */
function creatorOf(s: Snapshot): Map<string, string> {
  const creators = new Map<string, string>();
  for (const v of s.variants) {
    if (creators.has(v.modelId)) continue;
    for (const src of [v.sourceModel, ...(v.sourceModels ?? [])]) {
      if (!src?.url.startsWith("https://artificialanalysis.ai/")) continue;
      const c = src.metadata?.creator as { slug?: unknown } | undefined, lab = aaCreatorLab(c?.slug);
      if (lab) { creators.set(v.modelId, lab); break; }
    }
  }
  return creators;
}

/**
 * Models filed under `other` that Artificial Analysis credits to a lab (Granite to IBM, LFM to Liquid AI, Solar to Upstage) read as that
 * lab's, so every lab with a logo shows it. Only `other` moves, never a model a family pattern already placed (Llama-based fine-tunes stay
 * where the normalizer put them), and only on AA's word for who made it. A snapshot scraped after the scraper learned this has nothing to change.
 */
function withCreatorLabs(s: Snapshot): Snapshot {
  const others = s.models.filter((m) => m.labId === "other");
  if (!others.length) return s;
  const creators = creatorOf(s);
  if (!others.some((m) => creators.has(m.id))) return s;
  const labs = new Map(s.labs.map((l) => [l.id, l]));
  const models = s.models.map((m) => {
    const lab = m.labId === "other" ? creators.get(m.id) : undefined;
    if (!lab) return m;
    if (!labs.has(lab)) labs.set(lab, { id: lab, name: lab, color: NO_COLOR });
    return { ...m, labId: lab };
  });
  return { ...s, models, labs: [...labs.values()] };
}

/** Snapshots saved before a lab was named or colored (a lab seen first on a benchmark board is listed by its id, in grey) read as today's. */
export const withLabIdentity = (s: Snapshot): Snapshot => { const r = withCreatorLabs(s); return { ...r, labs: r.labs.map(labIdentity) }; };
