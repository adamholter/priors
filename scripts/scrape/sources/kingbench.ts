/**
 * KingBench 4, AICodeKing's YouTube benchmark (youtube.com/@AICodeKing): six one-prompt app builds (a Rust Game Boy, DS and 3DS
 * emulator, a Go Docker alternative, a 3D room designer, a QMK keyboard configurator, Pokémon Red and a Rust Fitbit desktop app),
 * each built in a fresh session with a 60-minute cutoff and graded out of 10 by the author as delivered. The total is out of 60;
 * Priors stores it as a percent. Each model runs in a coding tool (Claude Code, Codex, OpenCode, Antigravity CLI, PandaCode,
 * Devin), so a score is a model plus its tool.
 *
 * There is no leaderboard file: the scores are in the video descriptions, which state the tested model's total ("Neon finishes
 * with 37.9 out of 60") and often the chart around it ("behind only Claude Fable 5.2 (42.0) and beating Claude Opus 5.5 (34.7)").
 * The source searches the channel for KingBench 4, reads each video's description from its watch page and takes every score
 * stated there. A model named in several videos takes its newest figure. Short names the author uses ("Neon", "Full", "K3.1")
 * are read as the longer name written elsewhere in the same description.
 */
import type { RawRow, ScrapeResult, Source } from "../../../src/data/types";
import { normalizeLabel } from "../../../src/data/normalize";

export const KINGBENCH_ID = "kingbench-4";
const CHANNEL = "https://www.youtube.com/@AICodeKing";
const SEARCH = `${CHANNEL}/search?query=KingBench%204`;
const HEADERS = { "accept-language": "en-US,en;q=0.9", "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36" };

export type Video = { id: string; title: string; date: string; description: string };
export type Score = { label: string; percent: number; video: Video; said: string };

/** Lines about something else that carry numbers of their own: other benchmarks, prices, token counts, teams of models. */
const OTHER = /KingBench [0-35]|KingBench 2\.0|Terminal-Bench|SWE-bench|Vals|Artificial Analysis|LMArena|Arena|\$|tokens? |per million|lead-and-worker|team/i;
/** Names the author writes that are not models. */
const NOT_MODEL = /\b(with|and|team|room|emulator|designer|configurator|runtime|app|build|task|score|total|it|which|the|its|I|tested|testing|review|fully|vs)\b|\+|&|[?!:]/i;
/** The author's own words for a model that its longer name cannot be found from. */
const ALIASES: Record<string, string> = { "standard wonder": "Muse Wonder" };

/** A short name read as the longest name around it in the description that Priors knows ("Neon" in "Gemini 4 Neon"). */
function expand(name: string, description: string): string | null {
  const alias = ALIASES[name.toLowerCase()];
  if (alias) return alias;
  if (normalizeLabel(name).ok && name.split(/\s+/).length > 1) return name;
  const word = "[A-Z0-9][\\w.\\-]*";
  const near = new RegExp(`(?:${word}\\s+){0,3}${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s+${word}){0,3}`, "g");
  let best: string | null = null;
  for (const m of description.matchAll(near)) {
    const words = m[0].split(/\s+/), at = words.findIndex((w, i) => words.slice(i, i + name.split(/\s+/).length).join(" ") === name);
    for (let a = 0; a <= Math.max(0, at); a++) for (let b = words.length; b > a; b--) {
      const phrase = words.slice(a, b).join(" ").replace(/['’]s$/, "");
      if (!phrase.includes(name) || NOT_MODEL.test(phrase)) continue;
      if (normalizeLabel(phrase).ok && (!best || phrase.length > best.length)) best = phrase;
    }
  }
  return best ?? (normalizeLabel(name).ok ? name : null);
}

/** Every score a description states for KingBench 4, as [name as written, percent, the sentence]. */
export function scoresIn(description: string, title = ""): [string, number, string][] {
  if (!/KingBench 4/i.test(`${title}\n${description}`)) return [];
  const found: [string, number, string][] = [];
  const name = "([A-Z][\\w.\\-]*(?: [A-Z0-9][\\w.\\-]*){0,3})";
  for (const line of description.split(/\n+/)) {
    // The run-down paragraph repeats the takeaways; only the takeaway lines (they open with an emoji) and short lines are read.
    if (line.length > 400 || OTHER.test(line)) continue;
    const kb = /KingBench 4|out of 60|six builds|followed by|first at/i.test(line);
    const add = (who: string, percent: number) => { if (percent > 0 && percent <= 100 && !NOT_MODEL.test(who)) found.push([who.trim(), Math.round(percent * 10) / 10, line.trim()]); };
    for (const m of line.matchAll(new RegExp(`${name},?(?: [a-z][\\w ,]*?)? (?:scores|scored|totals|finishes with|finishes at|lands at) ([\\d.]+) out of 60`, "g"))) add(m[1], (+m[2] / 60) * 100);
    for (const m of line.matchAll(new RegExp(`${name} (?:scores|scored|totals) ([\\d.]+) out of 10\\b`, "g"))) add(m[1], +m[2] * 10);
    if (!kb) continue;
    if (/out of 60|out of \d+ models/.test(line)) for (const m of line.matchAll(new RegExp(`${name} \\(([\\d.]+)\\)`, "g"))) if (+m[2] <= 60) add(m[1], (+m[2] / 60) * 100);
    for (const m of line.matchAll(new RegExp(`${name}(?:,[^,%]{0,40},)?(?: (?:scores|scored|finishes first at|is first at|which scored|at)| ?['’]s) ([\\d.]+)%`, "g"))) add(m[1], +m[2]);
  }
  return found;
}

/** One row per model: its newest stated score. */
export function parseKingBench(videos: Video[]): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const best = new Map<string, Score>();
  for (const video of [...videos].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const [written, percent, said] of scoresIn(video.description, video.title)) {
      const label = expand(written, `${video.title}\n${video.description}`);
      if (!label) continue;
      const key = normalizeLabel(label);
      best.set(key.ok ? key.modelId : label.toLowerCase(), { label, percent, video, said });
    }
  }
  const rows: RawRow[] = [...best.values()].map((s) => ({
    benchmarkId: KINGBENCH_ID, modelLabel: s.label, effort: "high", value: s.percent, sourceUrl: `https://www.youtube.com/watch?v=${s.video.id}`,
    note: `${Math.round(s.percent * 0.6 * 10) / 10} of 60, from "${s.video.title}" (${s.video.date})`,
    details: { outOf60: Math.round(s.percent * 0.6 * 10) / 10, video: s.video.id, published: s.video.date, said: s.said },
  }));
  if (rows.length < 8) throw new Error(`KingBench 4: ${rows.length} models read from ${videos.length} videos; did the descriptions change?`);
  const updated = [...best.values()].map((s) => s.video.date).sort().at(-1);
  return {
    benchmarks: [{
      id: KINGBENCH_ID, name: "KingBench 4", shortName: "KingBench", sourceId: "kingbench", url: CHANNEL,
      description: "Six hard one-prompt app builds, from a Game Boy, DS and 3DS emulator to a Docker alternative and Pokémon Red, each graded out of 10 by AICodeKing as delivered.",
      unit: "percent", higherIsBetter: true, category: "coding", normalization: { kind: "linear", min: 0, max: 100 },
      eligibleForDefault: false, defaultWeight: 0, ...(updated ? { lastUpdated: updated } : {}),
    }],
    rows,
    notes: [`${rows.length} models from ${videos.filter((v) => scoresIn(v.description, v.title).length).length} KingBench 4 videos${updated ? `, newest ${updated}` : ""}`],
  };
}

/** The JSON a YouTube page sets in a script (`var ytInitialData = {...};`). */
function pageJson(html: string, name: string): unknown {
  const at = html.indexOf(`var ${name} = `);
  if (at < 0) return null;
  const start = html.indexOf("{", at);
  let depth = 0, inString = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) { if (c === "\\") i++; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true; else if (c === "{") depth++; else if (c === "}" && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  return null;
}

/** Video ids and titles in a channel search page. */
export function searchResults(html: string): { id: string; title: string }[] {
  const out = new Map<string, string>();
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) { o.forEach(walk); return; }
    if (!o || typeof o !== "object") return;
    const v = (o as { videoRenderer?: { videoId?: string; title?: { runs?: { text?: string }[] } } }).videoRenderer;
    if (v?.videoId && !out.has(v.videoId)) out.set(v.videoId, (v.title?.runs ?? []).map((r) => r.text ?? "").join(""));
    Object.values(o).forEach(walk);
  };
  walk(pageJson(html, "ytInitialData"));
  return [...out].map(([id, title]) => ({ id, title }));
}

/** A watch page's title, publish date and full description. */
export function watchDetails(html: string): Omit<Video, "id"> | null {
  const p = pageJson(html, "ytInitialPlayerResponse") as { videoDetails?: { title?: string; shortDescription?: string }; microformat?: { playerMicroformatRenderer?: { publishDate?: string } } } | null;
  const d = p?.videoDetails;
  if (!d?.shortDescription) return null;
  return { title: d.title ?? "", description: d.shortDescription, date: (p?.microformat?.playerMicroformatRenderer?.publishDate ?? "").slice(0, 10) };
}

const source: Source = {
  id: "kingbench", name: "KingBench 4", url: SEARCH,
  async scrape(ctx): Promise<ScrapeResult> {
    const search = await ctx.fetchText(SEARCH, { headers: HEADERS });
    const found = searchResults(search);
    if (!found.length) throw new Error("KingBench 4: the channel search returned no videos");
    const raw: Record<string, string> = { "search.html": search };
    const videos: Video[] = [];
    // Titles alone do not say which videos are KingBench 4 runs, so every result's description is read; old ones drop out there.
    for (const v of found.slice(0, 40)) {
      const html = await ctx.fetchText(`https://www.youtube.com/watch?v=${v.id}`, { headers: HEADERS });
      const d = watchDetails(html);
      if (!d) continue;
      videos.push({ id: v.id, ...d });
      if (/KingBench 4/i.test(`${d.title}\n${d.description}`)) raw[`${v.id}.txt`] = `${d.date} ${d.title}\n\n${d.description}`;
    }
    return { ...parseKingBench(videos), raw };
  },
};
export default source;
