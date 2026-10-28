import { frontierOf, type ScatterPoint } from "../components/chart/scatter-option";

/**
 * Which models a Pareto chart shows before anyone picks: every model with an effort on the chart's frontier, plus the
 * current model of each line from the labs people compare against (OpenAI, Anthropic, Google, Meta, xAI), plus any
 * highlighted model. Everything else (older versions, other labs off the frontier) is a click away in the chart's
 * settings. Judged from the models on the chart, so it adapts to each benchmark and needs no list of model names.
 */
export const FLAGSHIP_LABS = new Set(["openai", "anthropic", "google", "meta", "xai"]);

/** A line is a lab's name with the version blanked ("GPT-# Sol"); its family is the text before the version ("GPT-"). */
const VERSION = /(?<![\w.])(\d{1,2})(?:\.(\d{1,2}))?(?![\w.])/;
/** Open-weights size variants (Gemma 4 31B, E4B): not a line anyone means by "the current model". */
const SIZE = /\b[Ee]?\d+(?:\.\d+)?[Bb]\b/;
/** A line whose newest model is this much older than its lab's newest is no longer one the lab ships. */
const STALE_DAYS = 183;

interface Line { key: string; family: string; major: number; version: number; released?: string }
function lineOf(labId: string, name: string): Line {
  const n = name.replace(/\s*\([^)]*\)/g, "").trim().toLowerCase(), m = VERSION.exec(n);
  if (!m) return { key: `${labId}|${n} #`, family: `${labId}|${n} `, major: 0, version: 0 };
  return { key: `${labId}|${n.replace(VERSION, "#")}`, family: `${labId}|${n.slice(0, m.index)}`, major: Number(m[1]), version: Number(m[1]) + Number(m[2] ?? 0) / 100 };
}
const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/**
 * The current model of each flagship-lab line among `models`:
 * - the newest version of its line (Opus 5.5 over Opus 5, GPT-6.1 Sol over GPT-6 Sol and GPT-5.6 Sol);
 * - not from an older generation of its family that the lab has since moved past (GPT-5.5 after GPT-6 Astra, even
 *   though no "GPT-6" without a tier exists: the family is everything named "GPT-<version>");
 * - shipped within six months of the lab's newest model, and not an open-weights size variant.
 */
export function currentFlagships(models: { id: string; name: string; labId: string; releaseDate?: string }[]): Set<string> {
  const mine = models.filter((m) => FLAGSHIP_LABS.has(m.labId)).map((m) => ({ m, l: { ...lineOf(m.labId, m.name), released: m.releaseDate } }));
  const newestByLab = new Map<string, string>();
  for (const { m } of mine) if (m.releaseDate && m.releaseDate > (newestByLab.get(m.labId) ?? "")) newestByLab.set(m.labId, m.releaseDate);
  const out = new Set<string>();
  for (const { m, l } of mine) {
    if (SIZE.test(m.name)) continue;
    if (mine.some((o) => o.l.key === l.key && (o.l.version > l.version || (o.l.version === l.version && (o.l.released ?? "") > (l.released ?? ""))))) continue;
    if (mine.some((o) => o.l.family === l.family && o.l.major > l.major && (!o.l.released || !l.released || o.l.released >= l.released))) continue;
    const newest = newestByLab.get(m.labId);
    if (newest && l.released && days(l.released, newest) > STALE_DAYS) continue;
    out.add(m.id);
  }
  return out;
}

/** Model ids a Pareto chart shows by default (see above). `keep`: highlighted model or variant ids. */
export function focusModelIds(pts: ScatterPoint[], better: "lower" | "higher", keep: string[] = []): Set<string> {
  const out = new Set(frontierOf(pts, better).map((p) => p.r.model.id));
  const models = new Map(pts.map((p) => [p.r.model.id, p.r.model]));
  for (const id of currentFlagships([...models.values()])) out.add(id);
  for (const k of keep) out.add(k.split("@")[0]);
  return out;
}

/** The default view of a Pareto chart's points: only the focus models, every effort of each. */
export function focusPoints(pts: ScatterPoint[], better: "lower" | "higher", keep: string[] = []): ScatterPoint[] {
  const ids = focusModelIds(pts, better, keep);
  return pts.filter((p) => ids.has(p.r.model.id));
}
