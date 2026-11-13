/**
 * Reader candidates for a page nobody has configured yet, for `npm run board:try`: chart aria-labels, JSON <script>s and
 * JSON bodies (arrays of objects with a name-ish text field and a number), and <table>s. Pure: the CLI fetches and ranks.
 */
import { num } from "../harness";
import { ariaLabels, asArray, cellNum, htmlTables, parseAriaText, readTable, selectRows, toNum, type BoardRow, type SelectOptions } from "./readers";
import type { ReaderName } from "./run";

export interface Candidate { reader: ReaderName; options: Record<string, unknown>; rows: BoardRow[]; why: string; alternatives?: string[] }

const LABEL_KEY = [/^model_?name$|^modelname$/i, /^(display_?name|name)$/i, /^model$/i, /model|label|title|system|agent|llm/i, /^\$key$/];
const VALUE_GOOD = /score|accuracy|acc\b|pass|mean|avg|average|overall|value|elo|rating|win|percent|pct|result|solved|success/i;
const VALUE_BAD = /rank|\bid\b|_id|index|order|count|^n$|tokens?|cost|price|date|time|year|size|params|length|total|error|stderr|std|ci|lower|upper|low|high|margin|samples/i;
const EFFORT_KEY = /effort|reasoning/i;
const CI_KEY = /^(err|error|stderr|std_?err|margin|ci|ci95|half_?width)$/i;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lastKey = (p: string) => p.replace(/\[[^\]]*\]/g, "").split(".").pop() ?? p;

/** A key whose text values tell a list's objects apart, for `[key=value]` paths: a name-like key first, never a hash id when another works. */
export function discriminator(objs: Record<string, unknown>[]): string | undefined {
  const keys = Object.keys(objs[0] ?? {}).filter((k) => objs.every((x) => typeof x[k] === "string" && !(x[k] as string).includes("]")) && new Set(objs.map((x) => x[k])).size === objs.length);
  return [/key$|slug/i, /name|title|label/i, /pass|split|metric|harness/i].map((re) => keys.find((k) => re.test(k))).find(Boolean) ?? keys.find((k) => !k.startsWith("_") && !/id$/i.test(k)) ?? keys[0];
}

/** Leaf paths of one row object, three levels deep, with keyed sub-arrays as `[key=value]` ("passScores[pass=mean-8].score"). */
export function leafPaths(obj: unknown, prefix = "", depth = 3): { path: string; value: unknown }[] {
  if (obj == null || typeof obj !== "object" || depth < 0) return [];
  const out: { path: string; value: unknown }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v == null) continue;
    if (Array.isArray(v)) {
      const objs = v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
      const disc = objs.length === v.length ? discriminator(objs) : undefined;
      if (disc && objs.length <= 12) for (const x of objs) out.push(...leafPaths(x, `${p}[${disc}=${x[disc]}]`, depth - 1));
    } else if (typeof v === "object") out.push(...leafPaths(v, p, depth - 1));
    else out.push({ path: p, value: v });
  }
  return out;
}

/** Best label, value, effort and interval paths for an array of row objects, or undefined when it does not look like a board. */
export function guessFields(list: unknown[]): (SelectOptions & { alternatives: string[] }) | undefined {
  const objs = list.filter((x) => x && typeof x === "object" && !Array.isArray(x));
  if (objs.length < 3) return undefined;
  const seen = new Map<string, unknown[]>();
  for (const o of objs.slice(0, 60)) for (const { path, value } of leafPaths(o)) (seen.get(path) ?? seen.set(path, []).get(path)!).push(value);
  const n = Math.min(objs.length, 60), common = [...seen].filter(([, vs]) => vs.length >= n * 0.7);
  const strings = common.filter(([, vs]) => vs.every((v) => typeof v === "string" && /[A-Za-z]/.test(v)) && new Set(vs).size >= vs.length * 0.6);
  const label = LABEL_KEY.map((re) => strings.find(([p]) => re.test(lastKey(p)) && (p === "$key" || !/id$|slug|url|logo|color|link|key$/i.test(lastKey(p))))).find(Boolean)?.[0];
  if (!label) return undefined;
  const numeric = common.filter(([, vs]) => vs.every((v) => toNum(v) !== undefined) && new Set(vs.map(String)).size > 1).map(([p]) => p);
  const scored = numeric.map((p) => ({ p, s: (VALUE_GOOD.test(lastKey(p)) || VALUE_GOOD.test(p) ? 2 : 0) - (VALUE_BAD.test(lastKey(p)) ? 3 : 0) })).sort((a, b) => b.s - a.s);
  if (!scored.length || scored[0].s < 0) return undefined;
  const value = scored[0].p, base = value.slice(0, value.length - lastKey(value).length);
  const effort = common.find(([p, vs]) => EFFORT_KEY.test(lastKey(p)) && vs.some((v) => typeof v === "string"))?.[0];
  const ciHalf = numeric.find((p) => p.startsWith(base) && p !== value && CI_KEY.test(lastKey(p)));
  return { rows: "", label, value, ...(effort ? { effort } : {}), ...(ciHalf ? { ciHalf } : {}), alternatives: scored.slice(1).filter((x) => x.s >= 0).map((x) => x.p) };
}

/** Every array of row-like objects in a JSON document, with the path that selects it (`[key=value]` where elements have a unique key). */
export function jsonCandidates(data: unknown, reader: "nextData" | "json", extra: Record<string, unknown> = {}): Candidate[] {
  const out: Candidate[] = [];
  const walk = (v: unknown, path: string, depth: number) => {
    if (depth > 9 || v == null || typeof v !== "object") return;
    if (Array.isArray(v)) {
      const f = guessFields(v);
      if (f) {
        const { alternatives, ...sel } = f, options = { ...extra, ...sel, rows: path };
        try {
          const rows = selectRows(data, options);
          if (rows.length >= 3) out.push({ reader, options, rows, why: `${v.length} objects at ${path || "the root"}`, alternatives });
        } catch { /* not selectable */ }
      }
      const objs = v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<string, unknown>[];
      const disc = objs.length && objs.length === v.length ? discriminator(objs) : undefined;
      v.slice(0, 40).forEach((x, i) => walk(x, `${path}[${disc ? `${disc}=${(x as Record<string, unknown>)[disc]}` : i}]`, depth + 1));
      return;
    }
    // An object keyed by model ("gpt-5": { score }) reads as rows too, each with `$key`.
    const vals = Object.values(v);
    if (vals.length >= 3 && vals.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
      const f = guessFields(asArray(v)!);
      if (f && !/\./.test(f.label)) {
        const { alternatives, ...sel } = f, options = { ...extra, ...sel, rows: path };
        try { const rows = selectRows(data, options); if (rows.length >= 3) out.push({ reader, options, rows, why: `object of ${vals.length} rows at ${path || "the root"}`, alternatives }); } catch { /* not selectable */ }
      }
    }
    for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k, depth + 1);
  };
  walk(data, "", 0);
  return out;
}

export function ariaCandidates(html: string): Candidate[] {
  const seen = new Set<string>(), out: Candidate[] = [];
  for (const label of ariaLabels(html)) {
    if (seen.has(label)) continue;
    seen.add(label);
    const rows = parseAriaText(label);
    if (rows.length < 3) continue;
    const head = label.split(/\s+/).slice(0, 6).join(" ");
    // Counts in the opening words ("all 205 questions") change as a board grows, so they match any number.
    out.push({ reader: "ariaLabel", options: { match: new RegExp(`^${esc(head).replace(/\d+/g, "\\d+")}`) }, rows, why: `aria-label "${label.slice(0, 90)}${label.length > 90 ? "…" : ""}"` });
  }
  return out;
}

export function tableCandidates(html: string): Candidate[] {
  return htmlTables(html).flatMap((t, i): Candidate[] => {
    if (t.rows.length < 3 || t.headers.length < 2) return [];
    const col = (j: number) => t.rows.map((r) => r[j] ?? "");
    const numericCol = (j: number) => col(j).filter((c) => cellNum(c) !== undefined).length >= t.rows.length * 0.7;
    const textCol = (j: number) => col(j).filter((c) => /[A-Za-z]/.test(c) && num(c) === undefined).length >= t.rows.length * 0.7;
    const li = [t.headers.findIndex((h, j) => /model|name|system|agent|llm/i.test(h) && textCol(j)), t.headers.findIndex((_, j) => textCol(j))].find((j) => j >= 0);
    if (li === undefined) return [];
    const nums = t.headers.map((h, j) => ({ h, j })).filter(({ h, j }) => j !== li && numericCol(j) && !/^#$|rank|^n$|count|date|tokens|cost|price/i.test(h));
    if (!nums.length) return [];
    const best = nums.find(({ h }) => VALUE_GOOD.test(h)) ?? nums[0];
    const options: Record<string, unknown> = { table: i, label: t.headers[li], value: t.headers[best.j] };
    const effort = t.headers.findIndex((h) => EFFORT_KEY.test(h));
    if (effort >= 0) options.effort = t.headers[effort];
    let rows: BoardRow[] = [];
    try { rows = readTable(html, options as never); } catch { return []; }
    if (rows.length < 3) return [];
    return [{ reader: "table", options, rows, why: `table ${i}: [${t.headers.join(" | ")}], ${t.rows.length} rows`, alternatives: nums.filter((x) => x !== best).map((x) => x.h) }];
  });
}

/** JSON <script>s with an id (the nextData reader reads them by id). */
export function scriptCandidates(html: string): Candidate[] {
  const out: Candidate[] = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const id = m[1].match(/\bid=["']([^"']+)["']/)?.[1];
    if (!id || !(/application\/(ld\+)?json/i.test(m[1]) || id === "__NEXT_DATA__")) continue;
    let data: unknown;
    try { data = JSON.parse(m[2]); } catch { continue; }
    out.push(...jsonCandidates(data, "nextData", id === "__NEXT_DATA__" ? {} : { script: id }));
  }
  return out;
}

/** JSON files and fetch() targets the page names, resolved against its URL. */
export function jsonLinks(html: string, base: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/["'(`]((?:https?:\/\/|\/|\.\/)[^"'`()\s<>]*?\.json(?:\?[^"'`()\s<>]*)?)["')`]/g)) found.add(m[1]);
  for (const m of html.matchAll(/fetch\(\s*["'`]([^"'`]+)["'`]/g)) found.add(m[1]);
  return [...found].filter((u) => !/_buildManifest|_ssgManifest|manifest\.json|site\.webmanifest|package\.json|tsconfig/i.test(u)).flatMap((u) => { try { return [new URL(u, base).href]; } catch { return []; } }).slice(0, 8);
}

/** Every candidate in a fetched body: a JSON body is read as such, a page by every HTML reader. */
export function detectCandidates(body: string): Candidate[] {
  const t = body.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) {
    try { return jsonCandidates(JSON.parse(body), "json"); } catch { /* not JSON after all */ }
  }
  return [...ariaCandidates(body), ...scriptCandidates(body), ...tableCandidates(body)];
}
