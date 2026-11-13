/**
 * Generic leaderboard readers for config-only boards (`configs.ts`). Each is a pure function from the fetched text to
 * rows with the label exactly as the page prints it; label fixes, filtering and the benchmark record live in `run.ts`.
 *   ariaLabel  chart text in aria-label attributes: "Fable 5.2: 82.2%", "Dots 75.9%", "GPT-6 Astra: low 76.7% at $0.200 per question, medium ..."
 *   nextData   JSON in <script id="__NEXT_DATA__"> (or another JSON script by id), rows picked by a path
 *   json       a JSON endpoint, same path selection
 *   table      an HTML <table> picked by index or header text, columns by header name
 */
import { ci, num } from "../harness";
import { text } from "../sources/_board";

export interface BoardRow { modelLabel: string; value: number; effort?: string; ci?: [number, number]; costUsd?: number; details?: Record<string, unknown> }

const NUM = String.raw`-?\d+(?:\.\d+)?`;

export const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;|&#160;/g, " ");

/* ---------------- ariaLabel ---------------- */

export interface AriaOptions {
  /** Pick the aria-label whose text matches; without it, the label that parses into the most rows. */
  match?: string | RegExp;
  /** Drop the text up to the end of this match first (a sentence about products that are not models, say). */
  after?: string | RegExp;
}

export const ariaLabels = (html: string): string[] => [...html.matchAll(/aria-label=(?:"([^"]*)"|'([^']*)')/g)].map((m) => decode(m[1] ?? m[2]));

/** A cost is only read when the page says it is per task ("$0.20 per question"), never a token price. */
const COST = String.raw`(?:\s+at\s+\$(${NUM})\s+per\s+(?:question|task|problem|run|episode|item|sample|attempt|instance|game|puzzle))?`;

/** Rows from one aria-label's text. Clauses split on ";" and sentence ends; "Name: low 1% at $x per task, high ..." gives effort rows, other items "Name 1%" or "Name: 1%". */
export function parseAriaText(raw: string, opts: Pick<AriaOptions, "after"> = {}): BoardRow[] {
  let s = raw.replace(/\s+/g, " ").trim();
  if (opts.after) { const m = s.match(typeof opts.after === "string" ? new RegExp(opts.after) : opts.after); if (m) s = s.slice((m.index ?? 0) + m[0].length); }
  const rows: BoardRow[] = [];
  // A period ends a sentence only before a space and a capital, so "GPT-6.1" and "$1.50" survive.
  for (const clause of s.split(/;\s*|\.\s+(?=[A-Z])/)) {
    const effortClause = clause.match(new RegExp(String.raw`^(?:.*[.:]\s+)?([^:]+?):\s*((?:none|minimal|low|medium|high|xhigh|max)\s+${NUM}.*)$`, "i"));
    if (effortClause) {
      const label = effortClause[1].trim();
      for (const e of effortClause[2].matchAll(new RegExp(String.raw`\b(none|minimal|low|medium|high|xhigh|max)\s+(${NUM})\s*%?(\s*±\s*${NUM})?${COST}`, "gi"))) {
        const value = Number(e[2]), range = e[3] ? ci(`${e[2]}${e[3]}`) : undefined;
        rows.push({ modelLabel: label, effort: e[1].toLowerCase(), value, ...(range ? { ci: range } : {}), ...(e[4] ? { costUsd: Number(e[4]) } : {}) });
      }
      continue;
    }
    for (const item of clause.split(/,\s+/)) {
      const t = item.trim().replace(/\.$/, "");
      const valueRe = String.raw`(${NUM})\s*%?(\s*±\s*${NUM}\s*%?)?${COST}`;
      // "Name: 82.2%" first, else "Heading: Name 82.2%" with the heading dropped.
      const m = t.match(new RegExp(String.raw`^(?:.*:\s+)?([^:]+?):\s*${valueRe}$`)) ?? t.match(new RegExp(String.raw`^(?:.*:\s+)?([^:]+?)\s+${valueRe}$`));
      if (!m || !/[A-Za-z]/.test(m[1])) continue;
      const range = m[3] ? ci(`${m[2]}${m[3]}`) : undefined;
      rows.push({ modelLabel: m[1].trim(), value: Number(m[2]), ...(range ? { ci: range } : {}), ...(m[4] ? { costUsd: Number(m[4]) } : {}) });
    }
  }
  return rows;
}

export function readAriaLabel(html: string, opts: AriaOptions = {}): BoardRow[] {
  const labels = ariaLabels(html);
  if (opts.match) {
    const re = typeof opts.match === "string" ? new RegExp(opts.match) : opts.match;
    const hit = labels.find((l) => re.test(l));
    if (!hit) throw new Error(`no aria-label matches ${re}`);
    return parseAriaText(hit, opts);
  }
  return labels.map((l) => parseAriaText(l, opts)).sort((a, b) => b.length - a.length)[0] ?? [];
}

/* ---------------- paths (nextData, json) ---------------- */

/**
 * A small path language over parsed JSON: dot-separated keys, `[n]` for an index, `[key=value]` for the first element
 * whose `key` equals `value` (compared as text). An object where an array is expected becomes its entries, each with
 * its key as `$key`. Examples: `props.pageProps.benchmarks[leaderboardKey=open-world-engineer-leaderboard].globalLeaderboard`,
 * `passScores[pass=mean-8].score`, `model.modelName`.
 */
export function getPath(data: unknown, path: string): unknown {
  let cur: unknown = data;
  for (const seg of path.match(/[^.[\]]+|\[[^\]]*\]/g) ?? []) {
    if (cur == null) return undefined;
    if (seg.startsWith("[")) {
      const inner = seg.slice(1, -1), eq = inner.indexOf("=");
      const list = asArray(cur);
      if (!list) return undefined;
      cur = eq < 0 ? list[Number(inner)] : list.find((x) => x != null && typeof x === "object" && String(getPath(x, inner.slice(0, eq))) === inner.slice(eq + 1));
    } else cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

export function asArray(v: unknown): unknown[] | undefined {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") return Object.entries(v).map(([k, x]) => (x && typeof x === "object" && !Array.isArray(x) ? { $key: k, ...x } : { $key: k, value: x }));
  return undefined;
}

export interface SelectOptions {
  /** Path to the row array (or an object of rows keyed by model). Empty means the document itself. */
  rows: string;
  label: string;
  value: string;
  effort?: string;
  /** Half-width of the interval around the value. */
  ciHalf?: string;
  ciLow?: string;
  ciHigh?: string;
  /** Measured run cost per task, only when the page says so: never a token price. */
  cost?: string;
  /** Extra fields kept in the row's `details`, by name. */
  details?: Record<string, string>;
}

/** A JSON leaf as a number: numbers and numeric text only (a boolean or object is no score). */
export const toNum = (v: unknown) => (typeof v === "number" || typeof v === "string" ? num(v) : undefined);
const numAt = (row: unknown, path?: string) => (path ? toNum(getPath(row, path)) : undefined);

export function selectRows(data: unknown, o: SelectOptions): BoardRow[] {
  const list = asArray(o.rows ? getPath(data, o.rows) : data);
  if (!list) throw new Error(`no array at ${o.rows || "the document root"}`);
  const out: BoardRow[] = [];
  for (const row of list) {
    const label = getPath(row, o.label), value = numAt(row, o.value);
    if (typeof label !== "string" || !label.trim() || value === undefined) continue;
    const effort = o.effort ? getPath(row, o.effort) : undefined, cost = numAt(row, o.cost);
    const half = numAt(row, o.ciHalf), lo = numAt(row, o.ciLow), hi = numAt(row, o.ciHigh);
    const range: [number, number] | undefined = half !== undefined ? [value - half, value + half] : lo !== undefined && hi !== undefined ? [lo, hi] : undefined;
    const details = o.details && Object.fromEntries(Object.entries(o.details).map(([k, p]) => [k, getPath(row, p)]).filter(([, v]) => v != null));
    out.push({
      modelLabel: label.trim(), value,
      ...(typeof effort === "string" && effort ? { effort } : {}),
      ...(range ? { ci: range } : {}), ...(cost !== undefined ? { costUsd: cost } : {}),
      ...(details && Object.keys(details).length ? { details } : {}),
    });
  }
  return out;
}

/* ---------------- nextData / json ---------------- */

export interface NextDataOptions extends SelectOptions {
  /** id of the JSON <script>; default `__NEXT_DATA__`. */
  script?: string;
}

export function embeddedJson(html: string, id = "__NEXT_DATA__"): unknown {
  const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = html.match(new RegExp(`<script[^>]*\\bid=["']${esc}["'][^>]*>([\\s\\S]*?)</script>`))?.[1];
  if (body == null) throw new Error(`<script id="${id}"> missing`);
  return JSON.parse(body);
}

export const readNextData = (html: string, o: NextDataOptions): BoardRow[] => selectRows(embeddedJson(html, o.script), o);
export const readJson = (body: string, o: SelectOptions): BoardRow[] => selectRows(JSON.parse(body), o);

/* ---------------- table ---------------- */

export interface TableOptions {
  /** Which table: its index on the page, or text one of its header cells contains. Default the first. */
  table?: number | string;
  /** Column header names (case-insensitive; exact match wins, else the first header containing it). */
  label: string;
  value: string;
  effort?: string;
  /** A column holding "±1.2" or "[70, 75]"; without one a "70 ± 2" value cell still gives an interval. */
  ci?: string;
  cost?: string;
}

/**
 * Every <table> as header names and body rows of cell text. Header is the last <thead> row (a first row of group
 * headers with colspans names no column), else the first row of <th>s, else the first row.
 */
export function htmlTables(html: string): { headers: string[]; rows: string[][] }[] {
  const rowsOf = (s: string) => [...s.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => ({ th: /<th\b/i.test(r[1]), cells: [...r[1].matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi)].map((c) => decode(text(c[2]))) }));
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map((t) => {
    const head = t[1].match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i);
    if (head) return { headers: rowsOf(head[1]).at(-1)?.cells ?? [], rows: rowsOf(t[1].replace(head[0], "")).map((r) => r.cells).filter((c) => c.length) };
    const trs = rowsOf(t[1]), hi = Math.max(0, trs.findIndex((r) => r.th));
    return { headers: trs[hi]?.cells ?? [], rows: trs.filter((_, i) => i !== hi).map((r) => r.cells).filter((c) => c.length) };
  });
}

/** A table cell as a number: "70.2", "$1.11", "16.8k", or "43.2●" with a footnote mark. Cells with words are not numbers. */
export const cellNum = (s: string) => num(s) ?? (/[A-Za-z]/.test(s) ? undefined : num(s.replace(/[^\d.,%$±\s-]+/g, "").trim()));

export function columnIndex(headers: string[], name: string): number {
  const n = name.trim().toLowerCase(), h = headers.map((x) => x.trim().toLowerCase());
  const exact = h.indexOf(n);
  return exact >= 0 ? exact : h.findIndex((x) => x.includes(n));
}

export function readTable(html: string, o: TableOptions): BoardRow[] {
  const tables = htmlTables(html);
  const t = typeof o.table === "string" ? tables.find((x) => x.headers.some((h) => h.toLowerCase().includes((o.table as string).toLowerCase()))) : tables[o.table ?? 0];
  if (!t) throw new Error(`table ${o.table ?? 0} not found (${tables.length} tables)`);
  const col = (name?: string) => {
    if (!name) return -1;
    const i = columnIndex(t.headers, name);
    if (i < 0) throw new Error(`no column "${name}" in [${t.headers.join(" | ")}]`);
    return i;
  };
  const li = col(o.label), vi = col(o.value), ei = col(o.effort), cii = col(o.ci), coi = col(o.cost);
  const out: BoardRow[] = [];
  for (const cells of t.rows) {
    const label = cells[li]?.trim(), cell = cells[vi] ?? "", value = cellNum(cell);
    if (!label || value === undefined) continue;
    const ciCell = cii >= 0 ? cells[cii] ?? "" : "";
    const bracket = ciCell.match(new RegExp(String.raw`(${NUM})\s*[,–-]\s*(${NUM})`));
    const halfCol = ciCell.match(new RegExp(String.raw`±\s*(${NUM})`));
    const range: [number, number] | undefined = bracket ? [Number(bracket[1]), Number(bracket[2])] : halfCol ? [value - Number(halfCol[1]), value + Number(halfCol[1])] : ci(cell);
    const effort = ei >= 0 ? cells[ei]?.trim() : undefined, cost = coi >= 0 ? cellNum(cells[coi] ?? "") : undefined;
    out.push({ modelLabel: label, value, ...(effort ? { effort } : {}), ...(range ? { ci: range } : {}), ...(cost !== undefined ? { costUsd: cost } : {}) });
  }
  return out;
}
