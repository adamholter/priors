import { FOCUS_IDS, type Snapshot } from "@/data/types";
import { FOCUSES } from "@/onboarding/focus";
import { dedupe, headToHead, history, rankBands, rate, voteCount, type Ranking } from "./priorsbench";

/** Everything the /priorsbench page draws, computed on the server from the rankings and the snapshot's model names and labs. */
export interface BoardRow { id: string; name: string; labId: string; color?: string; rating: number; ci?: [number, number]; band: [number, number]; rankings: number; /** Rating change over the last week; null when the model was not rated a week ago. */ delta: number | null; /** Places moved up over the last week. */ move: number | null }
export interface BoardView { key: string; label: string; rankings: number; rows: BoardRow[] }
export interface BoardSeries { id: string; name: string; labId: string; color?: string; values: (number | null)[] }
export interface BoardData {
  views: BoardView[];
  totals: { rankings: number; votes: number; models: number; since: string };
  history: { dates: string[]; series: BoardSeries[] };
  h2h: { models: { id: string; name: string; labId: string; color?: string }[]; cells: { above: number; both: number }[][] };
}

const DAY = 86_400_000, HISTORY_LINES = 10, H2H_MODELS = 10, MIN_VIEW = 8;

export function buildBoard(rankings: Ranking[], snapshot: Snapshot | null, now = Date.now()): BoardData {
  const models = new Map(snapshot?.models.map((m) => [m.id, m]));
  const labs = new Map(snapshot?.labs.map((l) => [l.id, l]));
  const known = (id: string) => models.has(id);
  const who = (id: string) => { const m = models.get(id); return { id, name: m?.name ?? id, labId: m?.labId ?? "", color: labs.get(m?.labId ?? "")?.color }; };
  const kept = dedupe(rankings).filter((r) => FOCUS_IDS.includes(r.focus as never) && r.lineup.some(known));
  const view = (key: string, label: string, focus?: string): BoardView => {
    const now_ = rate(rankings, { asOf: now, bootstrap: focus ? 60 : 100, known, focus });
    const before = rate(rankings, { asOf: now - 7 * DAY, known, focus });
    const prev = new Map(before.map((r, i) => [r.modelId, { rating: r.rating, place: i + 1 }]));
    const bands = rankBands(now_);
    return {
      key, label, rankings: focus ? kept.filter((r) => r.focus === focus).length : kept.length,
      rows: now_.map((r, i) => { const p = prev.get(r.modelId); return { ...who(r.modelId), rating: r.rating, ci: r.ci, band: bands.get(r.modelId)!, rankings: r.rankings, delta: p ? Math.round((r.rating - p.rating) * 10) / 10 : null, move: p ? p.place - (i + 1) : null }; }),
    };
  };
  const all = view("all", "All");
  const views = [all, ...FOCUSES.map((f) => view(f.id, f.name, f.id)).filter((v) => v.rows.length >= MIN_VIEW)];
  const days = history(rankings, { now, known, stepDays: 1 });
  const top = all.rows.slice(0, HISTORY_LINES);
  const h2hIds = all.rows.slice(0, H2H_MODELS).map((r) => r.id);
  const first = Math.min(...kept.map((r) => r.createdAt));
  return {
    views,
    totals: { rankings: kept.length, votes: voteCount(kept), models: all.rows.length, since: new Date(Number.isFinite(first) ? first : now).toISOString().slice(0, 10) },
    history: { dates: days.map((d) => d.date), series: top.map((r) => ({ ...who(r.id), values: days.map((d) => d.ratings.find((x) => x.modelId === r.id)?.rating ?? null) })) },
    h2h: { models: h2hIds.map(who), cells: headToHead(kept, h2hIds) },
  };
}
