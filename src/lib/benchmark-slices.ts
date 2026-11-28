import type { Lab } from "@/data/types";
import type { RankedVariant } from "@/engine";
import { valueFor } from "./benchmark-chart";
import { formatMetric, type BenchMetric, type MetricGroup } from "./benchmark-metrics";

/**
 * What the benchmark page's pickers (category, version, measure, breakdown group) need that is not in the data as it comes:
 * sibling boards grouped the way a person reads them, measures placed in their sections, and who leads each choice.
 */

/** One model on a sibling board: what a picker shows when it says who leads. */
export type PeerTop = { id: string; name: string; labId: string; color?: string; /** The score as the board prints it. */ text: string; raw: number };
/** What the server works out for a sibling board (a category slice or another version): its result count and top models. */
export type Peer = { n: number; top: PeerTop[] };
export type SlicePeers = Record<string, Peer>;
export type Rel = { id: string; label: string };

/* ---------- category slices ---------- */

const LANGUAGES = new Set(["chinese", "english", "french", "german", "japanese", "korean", "polish", "russian", "spanish", "non-english", "portuguese", "italian", "arabic", "hindi", "turkish", "vietnamese", "thai", "indonesian"]);
const TASKS = new Set(["coding", "creative writing", "instruction following", "math"]);
const PROMPTS = new Set(["hard prompts", "hard prompts (english)", "expert", "longer queries", "multi-turn", "excluding ties"]);

export type SliceGroupKey = "overall" | "task" | "prompt" | "language" | "industry" | "other";
export const SLICE_GROUP_LABEL: Record<SliceGroupKey, string> = { overall: "Overall", task: "Task", prompt: "Prompt", language: "Language", industry: "Industry", other: "" };
const groupOf = (label: string, first: boolean): SliceGroupKey | null => {
  const l = label.toLowerCase();
  if (first) return "overall";
  if (l.startsWith("industry")) return "industry";
  if (LANGUAGES.has(l)) return "language";
  if (TASKS.has(l)) return "task";
  if (PROMPTS.has(l)) return "prompt";
  return null;
};
/** `short` is the name under its group header: "Industry: life, physical" reads "Life, physical" beneath Industry. */
export type SliceItem = Rel & { peer?: Peer; short: string };
export type SliceGroup = { key: SliceGroupKey; label: string; items: SliceItem[] };

/** Arena's text board splits into five families (overall, task, prompt, language, industry) by label. A list the labels do not explain stays one flat list. */
export function sliceGroups(family: Rel[], peers?: SlicePeers): SliceGroup[] {
  const items: SliceItem[] = family.map((x) => ({ ...x, peer: peers?.[x.id], short: x.label }));
  const keys = items.map((x, i) => groupOf(x.label, i === 0));
  const known = keys.filter(Boolean).length;
  if (items.length < 7 || known / items.length < 0.7) return [{ key: "other", label: "", items }];
  const out = new Map<SliceGroupKey, SliceItem[]>();
  items.forEach((x, i) => {
    const k = keys[i] ?? "prompt";
    if (k === "industry") { const t = x.label.replace(/^industry:\s*/i, ""); x.short = t.charAt(0).toUpperCase() + t.slice(1); }
    (out.get(k) ?? out.set(k, []).get(k)!).push(x);
  });
  return (["overall", "task", "prompt", "language", "industry"] as SliceGroupKey[]).filter((k) => out.has(k)).map((k) => ({ key: k, label: SLICE_GROUP_LABEL[k], items: out.get(k)! }));
}
/** The slices in the order a person reads them (grouped), flat. */
export const flatSlices = (groups: SliceGroup[]) => groups.flatMap((g) => g.items);

/* ---------- measures: the data is a tree, not a flat list ---------- */

const ACRONYMS: Record<string, string> = { llm: "LLM", hr: "HR", api: "API", ci: "CI", id: "ID", crm: "CRM", qa: "QA", ui: "UI", ai: "AI", elo: "Elo", cpu: "CPU", gpu: "GPU", sql: "SQL", url: "URL", ocr: "OCR", esg: "ESG", it: "IT", usd: "USD", mnist: "MNIST", cifar: "CIFAR", sat: "SAT", ecg: "ECG" };
const words = (s: string) => s.replace(/[_-]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").trim().toLowerCase().split(/\s+/).filter(Boolean);
export const sentence = (s: string) => words(s).map((w, i) => ACRONYMS[w] ?? (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(" ");
export const titled = (s: string) => words(s).map((w) => ACRONYMS[w] ?? (w.charAt(0).toUpperCase() + w.slice(1))).join(" ");

export type PRow = {
  id: string; label: string; name: string;
  section: string; entity?: string;
  /** Measures: lower values are better. */ lower?: boolean;
  /** Groups: how many columns it has. */ count?: number;
};
export type PEntity = { key: string; label: string; rows: PRow[] };
export type PSection = { key: string; label: string; rows: PRow[]; entities: PEntity[]; count: number };
export type PSet = { sections: PSection[]; rows: PRow[]; byId: Map<string, PRow> };

/** The section and entity a dotted path belongs to: "breakdown" is a section; "breakdown.byApp.gmail" is section "By app", entity "Gmail". */
function place(path: string): { section: string; label: string; entity?: string } {
  const parts = path ? path.split(".") : [];
  if (!parts.length) return { section: "", label: "Measures" };
  if (parts.length === 1) return { section: parts[0], label: sentence(parts[0]) };
  if (parts.length === 2) return { section: parts[0], label: sentence(parts[0]), entity: titled(parts[1]) };
  return { section: parts.slice(0, -1).join("."), label: sentence(parts[parts.length - 2]), entity: titled(parts[parts.length - 1]) };
}

function assemble(rows: PRow[]): PSet {
  const sections: PSection[] = [];
  for (const r of rows) {
    let s = sections.find((x) => x.key === r.section);
    if (!s) sections.push(s = { key: r.section, label: "", rows: [], entities: [], count: 0 });
    s.count++;
    if (r.entity) { let e = s.entities.find((x) => x.label === r.entity); if (!e) s.entities.push(e = { key: r.entity, label: r.entity, rows: [] }); e.rows.push(r); } else s.rows.push(r);
  }
  return { sections, rows, byId: new Map(rows.map((r) => [r.id, r])) };
}

/** Every published measure placed in its section, with a plain name ("LLM turn count", entity "Google Sheets"). */
export function measureSet(details: BenchMetric[]): PSet {
  const rows: PRow[] = details.map((m) => {
    const p = place(m.group ?? "");
    const name = sentence(m.key);
    const label = p.entity ? `${p.entity} · ${name}` : p.section ? `${p.label} · ${name}` : name;
    return { id: m.id, label, name, section: p.section, entity: p.entity, lower: m.better === "lower" };
  });
  const set = assemble(rows);
  // Section titles come from the path's own name; the top level has none.
  const labels = new Map(details.map((m) => [place(m.group ?? "").section, place(m.group ?? "").label]));
  for (const s of set.sections) s.label = labels.get(s.key) ?? "Measures";
  return set;
}

/** Breakdown groups the same way: "Breakdown (values)", "By domain" Finance, "By app" Gmail. */
export function groupSet(groups: MetricGroup[]): PSet {
  const rows: PRow[] = groups.map((g) => {
    const path = g.id.split("|")[0], p = place(path);
    const kind = /\(([^)]+)\)\s*$/.exec(g.label)?.[1];
    const base = p.entity ?? p.label;
    const label = kind ? `${base} · ${kind}` : base;
    return { id: g.id, label, name: label, section: p.section, count: g.metrics.length };
  });
  // The entities of the groups are rows of their own (one per app): plain rows of their section.
  const set = assemble(rows);
  const labels = new Map(groups.map((g) => { const p = place(g.id.split("|")[0]); return [p.section, p.label] as const; }));
  for (const s of set.sections) s.label = labels.get(s.key) ?? "Groups";
  return set;
}

/** The text of a row under its section header: the entity stays ("Gmail · Completion"), the section name does not repeat. */
export const rowText = (r: PRow) => r.entity ? r.label : r.name;

/** Search the way a person types: every word, any order, inside the section and the label. */
export function matches(r: PRow, q: string) {
  const t = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!t.length) return true;
  const hay = `${r.section} ${r.label} ${r.entity ?? ""}`.toLowerCase();
  return t.every((w) => hay.includes(w));
}

/* ---------- what a measure looks like: leader, spread, thumbnails ---------- */

export type Mark = { t: number; labId: string; color?: string };
export type MStat = {
  n: number; kind: BenchMetric["kind"]; min: number; max: number;
  leader?: { name: string; labId: string; color?: string; text: string };
  /** Top three by this measure (best first), t scaled 0 to 1 along min to max. */
  top: Mark[];
  /** Every model: x scaled 0 to 1 along min to max, y the score scaled 0 to 1. */
  pts: { x: number; y: number }[];
  /** The five best on the score, in lab colour. */
  hot: { x: number; y: number; labId: string; color?: string }[];
};

/** Statistics for one measure over the ranked rows the page charts. */
export function measureStat(m: BenchMetric, ranked: RankedVariant[], labs: Lab[]): MStat {
  const color = new Map(labs.map((l) => [l.id, l.color]));
  const rows = ranked.flatMap((r) => { const v = valueFor(m, r); return v != null && Number.isFinite(v) ? [{ r, v }] : []; });
  let min = Infinity, max = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const { r, v } of rows) { if (v < min) min = v; if (v > max) max = v; if (r.score < y0) y0 = r.score; if (r.score > y1) y1 = r.score; }
  if (!rows.length) { min = 0; max = 1; y0 = 0; y1 = 1; }
  const span = max > min ? max - min : 1, ySpan = y1 > y0 ? y1 - y0 : 1, lower = m.better === "lower";
  const best = [...rows].sort((a, b) => lower ? a.v - b.v : b.v - a.v);
  // One mark per model, however many efforts it has.
  const first = (list: typeof rows, n: number) => { const seen = new Set<string>(), out: typeof rows = []; for (const x of list) { if (seen.has(x.r.model.id)) continue; seen.add(x.r.model.id); out.push(x); if (out.length === n) break; } return out; };
  const top = first(best, 3).map(({ r, v }) => ({ t: (v - min) / span, labId: r.model.labId, color: color.get(r.model.labId) }));
  const hot = first([...rows].sort((a, b) => b.r.score - a.r.score), 5).map(({ r, v }) => ({ x: (v - min) / span, y: (r.score - y0) / ySpan, labId: r.model.labId, color: color.get(r.model.labId) }));
  const pts = rows.map(({ r, v }) => ({ x: (v - min) / span, y: (r.score - y0) / ySpan }));
  const lead = best[0];
  return { n: rows.length, kind: m.kind, min, max, top, pts, hot, ...(lead ? { leader: { name: lead.r.model.name, labId: lead.r.model.labId, color: color.get(lead.r.model.labId), text: formatMetric(m.kind, lead.v) } } : {}) };
}

/** One shade of the Breakdown table: where a value sits in its column (0 to 1), darker is better. */
export const shadeOf = (t: number, lower: boolean) => `color-mix(in oklab, var(--indigo) ${Math.round(6 + 44 * (lower ? 1 - t : t))}%, transparent)`;

/** A path of zero-length segments: one SVG path draws every dot of one colour (round caps make them circles). */
export const dotPath = (pts: { x: number; y: number }[], w: number, h: number, pad: number) => pts.map((p) => `M${(pad + p.x * (w - 2 * pad)).toFixed(1)} ${(h - pad - p.y * (h - 2 * pad)).toFixed(1)}h0`).join("");
