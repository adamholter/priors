import { featuredPoints, frontierOf, type Highlight, type ScatterPoint } from "./scatter-option";
import { isHighlighted, modelOf, type HighlightModel } from "./highlight";

/** Pure logic behind the star picker and the starred-name line: grouping, ranks on the dot strip, quick picks, how many names fit, the two-star difference. */

/** The most stars a chart takes (the link format keeps 12). */
export const STAR_CAP = 12;
/** Past this many stars guides and effort tags show only for the star under the pointer, so the plot stops piling up. */
export const STAR_DENSE = 4;

export const effortOf = (item: string) => { const e = item.split("@")[1]?.split("~")[0]; return e && e !== "default" ? e : ""; };
/** Lab names as the data has them ("baidu"): the first letter up. */
export const labTitle = (s: string) => (s === s.toLowerCase() ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** The lab's logo id: the model's own, else its lab name squeezed to an id. */
export const labIdOf = (m: HighlightModel) => m.labId ?? norm(m.lab ?? "");
/** Rows match on model name and lab name, like the gear's model list. */
export const matches = (m: HighlightModel, q: string) => { const n = q.trim().toLowerCase(); return !n || `${m.name} ${m.lab ?? ""}`.toLowerCase().includes(n); };
/** Efforts a model is starred at ("xhigh", "low"), for the faint text on a row. */
export const effortsFor = (items: string[], id: string) => items.filter((it) => modelOf(it) === id).map(effortOf).filter(Boolean);

/** The models worth starring: the ranked ones, in rank order, plus anything already starred (so it can be unstarred). `ranked` is how many leading entries are ranked; without it every model is listed. */
export function pickable(models: HighlightModel[], ranked: number | undefined, items: string[]) {
  return ranked && ranked < models.length ? models.filter((m, i) => i < ranked || isHighlighted(items, m.id)) : models;
}

export type StarRow = { m: HighlightModel; rank: number };
export type StarGroup = { key: string; name: string; labId: string; color?: string; rows: StarRow[] };
/** Labs in the order their best model ranks. A model's rank is its place among `models`. */
export function labGroups(models: HighlightModel[]): StarGroup[] {
  const by = new Map<string, StarGroup>();
  models.forEach((m, i) => {
    const key = m.lab ?? m.name; let g = by.get(key);
    if (!g) { g = { key, name: labTitle(key), labId: labIdOf(m), color: m.color, rows: [] }; by.set(key, g); }
    g.rows.push({ m, rank: i + 1 });
  });
  return [...by.values()];
}

/** One dot per model at its rank across `width` px. A dot that would touch the last one in its lane steps to the next of three lanes (middle, up, down). */
export function stripDots(rows: StarRow[], total: number, width: number) {
  const last = [-99, -99, -99], lane = [0, -6, 6];
  return rows.map(({ m, rank }) => {
    const x = 5 + (width - 10) * (total > 1 ? (rank - 1) / (total - 1) : 0);
    let k = last.findIndex((l) => l < x - 7.5);
    if (k < 0) k = last.indexOf(Math.min(...last));
    last[k] = x;
    return { m, rank, x, y: lane[k] };
  });
}

/** Whether every id of a quick pick is already starred (a variant id counts when the item or its model is). */
export const allStarred = (items: string[], ids: string[]) => ids.length > 0 && ids.every((id) => (id.includes("@") ? items.includes(id) || items.includes(modelOf(id)) : isHighlighted(items, id)));

export type QuickPick = { id: "top" | "frontier" | "newest"; label: string; ids: string[] };
/** Top 5, the chart's frontier and the newest model of each lab. Those that find nothing are left out. */
export function quickPicks(models: HighlightModel[], pts: ScatterPoint[] | undefined, better: "lower" | "higher" | undefined, groups: StarGroup[]): QuickPick[] {
  const list: QuickPick[] = [{ id: "top", label: "Top 5", ids: models.slice(0, 5).map((m) => m.id) }];
  if (pts?.length) {
    const ok = new Set(models.map((m) => m.id));
    list.push({ id: "frontier", label: "Frontier", ids: [...new Set(frontierOf(pts, better ?? "lower").map((p) => p.r.variant.id))].slice(0, 8) });
    const newest = new Map<string, { id: string; d: string }>();
    for (const p of pts) { const d = p.r.model.releaseDate, cur = newest.get(p.r.model.labId); if (d && (!cur || d > cur.d)) newest.set(p.r.model.labId, { id: p.r.model.id, d }); }
    const ids: string[] = [];
    for (const g of groups) { const n = newest.get(g.labId); if (n && ok.has(n.id)) ids.push(n.id); }
    list.push({ id: "newest", label: "Newest per lab", ids: [...new Set(ids)] });
  }
  return list.filter((q) => q.ids.length);
}

/** Add ids that are not starred yet, up to the cap. */
export function addStars(items: string[], ids: string[]) {
  const next = [...items];
  for (const id of ids) if (!(id.includes("@") ? next.includes(id) : isHighlighted(next, id)) && next.length < STAR_CAP) next.push(id);
  return next;
}
/** Drop every item of these models or variants. */
export const removeStars = (items: string[], ids: string[]) => items.filter((it) => !ids.includes(modelOf(it)) && !ids.includes(it));

/** Past a few stars the dashed guides and axis badges switch off; the star under the pointer still draws its own. */
export const starGuides = (h: Highlight | undefined): Highlight | undefined => (!h || h.items.length <= STAR_DENSE ? h : { ...h, guides: false });
/** Past a few stars a highlighted model's other efforts show their tag only when you point at them. */
export const starTags = (h: Highlight): Highlight => (h.items.length > STAR_DENSE ? { ...h, tags: false } : h);
/** The mark of the starred item under the pointer in the name line, or null. */
export const hotPick = (shown: ScatterPoint[], hot: string | null) => (hot ? featuredPoints(shown, [hot])[0] ?? null : null);

/** Longest a name's text runs before it ellipsizes (star-menu.css `.star-name` max-width is this plus the logo, gaps and x). */
export const NAME_TEXT_MAX = 180;
/** Width of one name in the line: its logo, the gap, the text (capped like the line caps it), the x, and the gap to the next. */
export const nameWidth = (text: number) => 14 + 6 + Math.min(NAME_TEXT_MAX, text) + 24 + 12;
const MORE_W = 40, ONE_NAME_MIN = 120;
/** As many whole names as `budget` px holds (all of them when it is 0, unmeasured), never more than `cap`; the rest fold into +N. A budget too small for even one name returns 0 unless it still holds `ONE_NAME_MIN`, where one name ellipsizes. `used` is the width taken. */
export function fitNames(widths: number[], cap: number, budget: number) {
  let used = 0, fit = 0;
  for (let i = 0; i < Math.min(cap, widths.length); i++) {
    const more = i < widths.length - 1 ? MORE_W : 0;
    if (budget && used + widths[i] + more > budget) { if (fit === 0 && budget >= ONE_NAME_MIN) { fit = 1; used = budget; } break; }
    used += widths[i]; fit++;
  }
  return { fit, used };
}

/** Two stars on a scatter: how much better the leader scores and how its cost or time compares. Null for any other count or when a mark is not drawn. */
export function starDelta(items: string[], pts: ScatterPoint[] | undefined, xName: string | undefined, label: (item: string) => string) {
  if (items.length !== 2 || !pts || !xName) return null;
  const ps = items.map((it) => featuredPoints(pts, [it])[0]);
  if (!ps[0] || !ps[1]) return null;
  const hi = ps[0].r.score >= ps[1].r.score ? 0 : 1, a = ps[hi], b = ps[1 - hi];
  const word = /\$|cost|price/i.test(xName) ? "cost" : /time|latency|\bs\b/i.test(xName) ? "time" : xName.split(",")[0].toLowerCase();
  const x = b.x > 0 ? a.x / b.x : null, d = a.r.score - b.r.score;
  const times = x === null ? "" : x >= 10 ? String(Math.round(x)) : x.toFixed(1);
  return { d, x, times, word, lead: items[hi], text: `${label(items[hi])} scores ${d.toFixed(1)} higher${x !== null ? ` at ${times} times the ${word}` : ""}` };
}

/** Whole rows only: how many rows fit under `chrome` px of fixed parts, so the list never ends mid-row. */
export const rowsThatFit = (space: number, chrome: number, rowH: number) => Math.max(4, Math.floor((space - chrome) / rowH));
