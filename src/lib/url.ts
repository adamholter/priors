import { DEFAULT_CUTOFF, type IndexConfig } from "../engine";

/**
 * URL state for anonymous builds. One index per `i` param so multiple indices share a link:
 *   ?i=General%20frontier|frontierswe-v2:25,terminalbench-4:25,deepswe-1.1:10|req=deepswe-1.1|cut=5|est=1|var=all
 * Fields after the weights are optional. Names are URL-encoded; benchmark IDs may include a source namespace separated by a colon.
 */
export function encodeIndex(c: IndexConfig): string {
  const parts = [encodeURIComponent(c.name), Object.entries(c.weights).filter(([, w]) => w > 0).map(([k, w]) => `${k}:${round(w)}`).join(",")];
  if (c.required.length) parts.push(`req=${c.required.join(",")}`);
  if (c.optional?.length) parts.push(`opt=${c.optional.join(",")}`);
  if (c.strictness != null) parts.push(`strict=${round(c.strictness)}`);
  if (c.rankingVariants) parts.push(`bars=${c.rankingVariants}`);
  if (c.paretoVariants) parts.push(`pareto=${c.paretoVariants}`);
  if (c.cutoff !== DEFAULT_CUTOFF) parts.push(`cut=${round(c.cutoff)}`);
  if (!c.estimateMissing) parts.push("est=0");
  if (c.variants !== "all") parts.push(`var=${c.variants}`);
  if (c.effortMatching) parts.push(`effort=${c.effortMatching}`);
  if (c.labs?.length) parts.push(`labs=${c.labs.join(",")}`);
  if (c.excludeModels?.length) parts.push(`ex=${c.excludeModels.join(",")}`);
  if (c.releasedAfter) parts.push(`after=${c.releasedAfter}`);
  return parts.join("|");
}

export function decodeIndex(s: string, id: string): IndexConfig | null {
  const [name, weightsStr, ...rest] = s.split("|");
  if (name == null || weightsStr == null) return null;
  const weights: Record<string, number> = {};
  for (const kv of weightsStr.split(",")) { const split = kv.lastIndexOf(":"); const k = kv.slice(0, split), v = kv.slice(split + 1); const w = Number(v); if (split > 0 && k && Number.isFinite(w) && w > 0) weights[k] = w; }
  const c: IndexConfig = { id, name: decodeURIComponent(name) || "Untitled", weights, required: [], cutoff: DEFAULT_CUTOFF, estimateMissing: true, variants: "all" };
  for (const r of rest) {
    const [k, v = ""] = r.split("=");
    if (k === "req") c.required = v.split(",").filter(Boolean);
    else if (k === "opt") c.optional = v.split(",").filter(Boolean);
    else if (k === "strict" && Number.isFinite(Number(v))) c.strictness = Math.max(0, Math.min(100, Number(v)));
    else if (k === "bars" && (v === "all" || v === "best")) c.rankingVariants = v;
    else if (k === "pareto" && (v === "all" || v === "best")) c.paretoVariants = v;
    else if (k === "cut") { const n = parseFloat(v); if (Number.isFinite(n)) c.cutoff = n; }
    else if (k === "est") c.estimateMissing = v !== "0";
    else if (k === "var" && (v === "all" || v === "best")) c.variants = v;
    else if (k === "effort" && (v === "calibrated" || v === "nearest" || v === "strict")) c.effortMatching = v;
    else if (k === "labs") c.labs = v.split(",").filter(Boolean);
    else if (k === "ex") c.excludeModels = v.split(",").filter(Boolean);
    else if (k === "after") c.releasedAfter = v;
  }
  return c;
}

export function encodeIndices(list: IndexConfig[]): URLSearchParams {
  const p = new URLSearchParams();
  list.forEach((c) => p.append("i", encodeIndex(c)));
  return p;
}

export function decodeIndices(params: URLSearchParams | string[]): IndexConfig[] {
  const vals = Array.isArray(params) ? params : params.getAll("i");
  return vals.map((v, i) => decodeIndex(v, `i${i}`)).filter((x): x is IndexConfig => !!x);
}

const round = (n: number) => Math.round(n * 10) / 10;
