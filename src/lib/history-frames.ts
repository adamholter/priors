/**
 * The history of a ranking: one top-N table per snapshot date, and the in-between frames that let a
 * chart move smoothly from one date to the next. Pure and shared by the page and the video render.
 */
export interface HistoryRow { id: string; modelId: string; name: string; effort: string; labId: string; score: number }
export interface HistoryFrame { date: string; rows: HistoryRow[]; /** weighted benchmarks that counted that day */ used: number; of: number; models: number }
export interface HistoryData {
  name: string; mode: "fixed" | "adapting"; frames: HistoryFrame[];
  labs: { id: string; name: string; color: string }[];
  /** Score range of everything shown, so bars keep one scale through time. */
  domain: [number, number];
}
export const TOP = 20;

export interface Placed { id: string; modelId: string; name: string; effort: string; labId: string; score: number; /** 0 = first place; fractional while two models swap */ y: number; opacity: number }

/** Models at a fractional frame position (0 = oldest frame). Between two frames each model slides from its place in one to its place in the other; one present in only one slides in from (or out to) the bottom and fades. */
export function placeAt(data: HistoryData, pos: number, top = TOP): Placed[] {
  const last = data.frames.length - 1, p = Math.min(Math.max(pos, 0), last), i = Math.min(Math.floor(p), Math.max(last - 1, 0)), f = last === 0 ? 0 : p - i;
  const a = data.frames[i], b = data.frames[Math.min(i + 1, last)];
  const rowsA = new Map(a.rows.map((r, k) => [r.id, { r, k }])), rowsB = new Map(b.rows.map((r, k) => [r.id, { r, k }]));
  const out: Placed[] = [];
  for (const id of new Set([...rowsA.keys(), ...rowsB.keys()])) {
    const x = rowsA.get(id), y = rowsB.get(id), near = (f < 0.5 ? x ?? y : y ?? x)!.r;
    const ka = x?.k ?? Math.max(top, a.rows.length), kb = y?.k ?? Math.max(top, b.rows.length);
    const row = ka + (kb - ka) * f, score = x && y ? x.r.score + (y.r.score - x.r.score) * f : (x ?? y)!.r.score;
    // A row fades as it nears the cut, so entering and leaving the top never pops.
    out.push({ id, modelId: near.modelId, name: near.name, effort: near.effort, labId: near.labId, score, y: row, opacity: Math.max(0, Math.min(x && y ? 1 : x ? 1 - f : f, top + 0.5 - row)) });
  }
  return out.filter((m) => m.opacity > 0.01).sort((u, v) => u.y - v.y);
}

/** "2026-10-16" at a fractional frame position: the nearer snapshot's date. */
export const dateAt = (data: HistoryData, pos: number) => data.frames[Math.min(Math.max(Math.round(pos), 0), data.frames.length - 1)].date;
