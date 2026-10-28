import { isCostBasis } from "../data/subscription";
import { isTaskMetricSource } from "../data/task-metrics";
import { DEFAULT_CUTOFF, EFFORT_CHOICES, type IndexConfig } from "../engine";
import { FOCUS_IDS, type FocusId } from "../data/types";

/**
 * URL state for anonymous builds. One index per `i` param so multiple indices share a link:
 *   ?i=General%20frontier|frontierswe-v2:25,terminalbench-4:25,deepswe-1.1:10|req=deepswe-1.1|cut=5|est=1|var=all
 * Fields after the weights are optional. Names are URL-encoded; benchmark IDs may include a source namespace separated by a colon.
 */
/**
 * Builder only: the published page index a config was opened from, as "handle.id.key". It rides along
 * at runtime and is never stored. Anyone can write a link, so the builder only trusts a reference whose
 * key is the one this browser tab made when the owner clicked "Open in builder" on their page
 * (`PAGE_KEY` in sessionStorage). A link from someone else carries no such key and falls back to
 * matching by name, like any other index.
 */
export type FromPage = IndexConfig & { page?: string };
export const PAGE_KEY = "priors:page-key";
export const pageRef = (handle: string, id: string, key: string) => `${handle}.${id}.${key}`;
/** The id of the page index this builder index came from, when the reference is for this page and carries this tab's key. */
export function pageIndexId(index: FromPage, handle: string, key: string | null | undefined): string | undefined {
  const ref = index.page;
  if (!ref || !key || !ref.startsWith(`${handle}.`) || !ref.endsWith(`.${key}`)) return undefined;
  return ref.slice(handle.length + 1, -(key.length + 1)) || undefined;
}

export function encodeIndex(c: FromPage, keepPage = false): string {
  const parts = [encodeURIComponent(c.name), Object.entries(c.weights).filter(([, w]) => w > 0).map(([k, w]) => `${k}:${round(w)}`).join(",")];
  if (c.required.length) parts.push(`req=${c.required.join(",")}`);
  if (c.optional?.length) parts.push(`opt=${c.optional.join(",")}`);
  if (c.strictness != null) parts.push(`strict=${round(c.strictness)}`);
  if (c.rankingVariants) parts.push(`bars=${c.rankingVariants}`);
  if (c.paretoVariants) parts.push(`pareto=${c.paretoVariants}`);
  if (c.efforts) parts.push(`eff=${c.efforts.join(",")}`);
  if (c.rankingEfforts) parts.push(`reff=${c.rankingEfforts.join(",")}`);
  if (c.cutoff !== DEFAULT_CUTOFF) parts.push(`cut=${round(c.cutoff)}`);
  if (!c.estimateMissing) parts.push("est=0");
  if (c.variants !== "all") parts.push(`var=${c.variants}`);
  if (c.effortMatching) parts.push(`effort=${c.effortMatching}`);
  if (c.labs?.length) parts.push(`labs=${c.labs.join(",")}`);
  if (c.excludeModels) parts.push(`ex=${c.excludeModels.join(",")}`);
  if (c.onlyModels !== undefined) parts.push(`only=${c.onlyModels.join(",")}`);
  if (c.releasedAfter !== undefined) parts.push(`after=${c.releasedAfter}`);
  if (c.costSource && c.costSource !== "aa") parts.push(`costsrc=${c.costSource}`);
  if (c.costBasis === "api") parts.push(`costbasis=${c.costBasis}`);
  if (c.planResets === false) parts.push("resets=off");
  if (c.timeSource && c.timeSource !== "aa") parts.push(`timesrc=${c.timeSource}`);
  if (c.focus) parts.push(`focus=${c.focus}`);
  if (c.highlight?.length) parts.push(`hl=${c.highlight.join(",")}`);
  if (keepPage && c.page) parts.push(`page=${c.page}`);
  return parts.join("|");
}

/**
 * Retired benchmark ids → their live equivalents. The frozen Real Index import (Sept 2026) was removed
 * in favour of live scrapers; old links keep their weights by pointing at the live benchmark.
 */
const RETIRED: Record<string, string> = Object.fromEntries(Object.entries({
  "automationbench-aa": "aa-automationbench-aa", "gdp-pdf": "aa-gdp-pdf", "arena-text-multi-turn": "arena-text-multi-turn", "agent-arena": "arena-agent",
  "osworld-2": "osworld-2", "osworld-verified": "osworld-verified", "roboflow-visual-reasoning": "roboflow-visual-reasoning", "terminal-bench-2-1": "aa-terminalbench-v2-1",
  "mmmu-pro": "aa-mmmu-pro", "arc-agi-2": "arc-agi-2", "automationbench": "automationbench", "enterprise-ops-gym-aa": "aa-enterprise-ops-gym-aa",
  "terminal-bench-science": "aa-terminalbench-science", "aa-lcr": "aa-artificial-analysis-long-context-reasoning", "aa-briefcase": "aa-briefcase",
  "terminal-bench-v4": "terminalbench-4", "deepswe-1-1": "deepswe-1.1", "swe-atlas-qna": "swe-atlas-qna", "arc-agi-3": "arc-agi-3", "hle": "aa-humanitys-last-exam",
  "aa-omniscience": "aa-omniscience", "tau3-banking": "aa-tau3-banking", "scicode": "aa-scicode", "aa-omniscience-accuracy": "aa-omniscience-accuracy",
  "aa-omniscience-hallucination-rate": "aa-omniscience-non-hallucination", "critpt": "aa-critpt", "output-speed": "aa-output-speed", "cost-per-task": "aa-cost-per-task-index",
}).map(([k, v]) => [`real-index:${k}`, v]));
export const liveBenchmarkId = (id: string) => RETIRED[id] ?? id;

export function decodeIndex(s: string, id: string): IndexConfig | null {
  const [name, weightsStr, ...rest] = s.split("|");
  if (name == null || weightsStr == null) return null;
  const weights: Record<string, number> = {};
  for (const kv of weightsStr.split(",")) { const split = kv.lastIndexOf(":"); const k = liveBenchmarkId(kv.slice(0, split)), v = kv.slice(split + 1); const w = Number(v); if (split > 0 && k && Number.isFinite(w) && w > 0) weights[k] = (weights[k] ?? 0) + w; }
  const c: IndexConfig = { id, name: decodeURIComponent(name) || "Untitled", weights, required: [], cutoff: DEFAULT_CUTOFF, estimateMissing: true, variants: "all" };
  // Default: strictness 50. `strict=` or `cut=` (legacy) override; `after=` is
  // explicit-only — absent means the engine default (snapshot date − 6 months),
  // and `after=` with no value means "all time" (no age filter).
  if (!rest.some((r) => r.startsWith("strict=") || r.startsWith("cut="))) c.strictness = 50;
  for (const r of rest) {
    const [k, v = ""] = r.split("=");
    if (k === "req") c.required = [...new Set(v.split(",").filter(Boolean).map(liveBenchmarkId))];
    else if (k === "opt") c.optional = [...new Set(v.split(",").filter(Boolean).map(liveBenchmarkId))];
    else if (k === "strict" && Number.isFinite(Number(v))) c.strictness = Math.max(0, Math.min(100, Number(v)));
    else if (k === "bars" && (v === "all" || v === "best")) c.rankingVariants = v;
    else if (k === "pareto" && (v === "all" || v === "best")) c.paretoVariants = v;
    else if (k === "eff") c.efforts = v.split(",").filter((e) => (EFFORT_CHOICES as readonly string[]).includes(e));
    else if (k === "reff") c.rankingEfforts = v.split(",").filter((e) => (EFFORT_CHOICES as readonly string[]).includes(e));
    else if (k === "cut") { const n = parseFloat(v); if (Number.isFinite(n)) c.cutoff = n; }
    else if (k === "est") c.estimateMissing = v !== "0";
    else if (k === "var" && (v === "all" || v === "best")) c.variants = v;
    else if (k === "effort" && (v === "calibrated" || v === "nearest" || v === "strict")) c.effortMatching = v;
    else if (k === "labs") c.labs = v.split(",").filter(Boolean);
    else if (k === "ex") c.excludeModels = v.split(",").filter(Boolean);
    else if (k === "only") c.onlyModels = v.split(",").filter(Boolean);
    else if (k === "after") c.releasedAfter = v;
    else if (k === "costsrc" && isTaskMetricSource(v)) c.costSource = v;
    else if (k === "costbasis" && isCostBasis(v)) c.costBasis = v;
    else if (k === "resets" && v === "off") c.planResets = false;
    else if (k === "timesrc" && isTaskMetricSource(v)) c.timeSource = v;
    else if (k === "focus" && FOCUS_IDS.includes(v as FocusId)) c.focus = v as FocusId;
    else if (k === "hl") c.highlight = v.split(",").filter(Boolean).slice(0, 12);
    else if (k === "page" && v) (c as FromPage).page = v;
  }
  return c;
}

/** `keepPage` keeps each index's link back to the page it came from: only for the builder's own address and "Open in builder". */
export function encodeIndices(list: FromPage[], keepPage = false): URLSearchParams {
  const p = new URLSearchParams();
  list.forEach((c) => p.append("i", encodeIndex(c, keepPage)));
  return p;
}

/**
 * A query string a person can read: `:`, `,` and `=` stay as typed and a space in a name is `+`,
 * where URLSearchParams would write %3A, %2C, %3D and %2520. It parses back to the same params.
 * The `|` between fields stays escaped, because chat apps cut a link at a bare pipe.
 */
export function prettyQuery(params: URLSearchParams | string): string {
  return params.toString().replace(/%3A/g, ":").replace(/%2C/g, ",").replace(/%3D/g, "=").replace(/%2520/g, "+");
}

export function decodeIndices(params: URLSearchParams | string[]): IndexConfig[] {
  const vals = Array.isArray(params) ? params : params.getAll("i");
  return vals.map((v, i) => decodeIndex(v, `i${i}`)).filter((x): x is IndexConfig => !!x);
}

const round = (n: number) => Math.round(n * 10) / 10;
