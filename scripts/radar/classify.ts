/**
 * The radar's pure parts: what a post is about, which model names it mentions, which Priors benchmarks it touches, and which items are new.
 * Keyword rules on purpose: every decision carries the words that made it, so a wrong call can be read and fixed in one line.
 */
import type { NameCheck } from "./name-check";

export type Kind = "benchmark" | "model" | "other";
export interface Post { status: string; time: string; text: string; links: { href: string; text: string }[]; social?: string; images?: number }
export interface BenchMatch { id: string; name: string; by: "url" | "name" }
/** A site Priors already reads benchmarks from, and how many. */
export interface KnownSite { host: string; benchmarks: number }
export interface InboxItem {
  id: string;
  source: "x" | "scrape-log";
  kind: Kind;
  /** The words and signals behind `kind`. */
  reasons: string[];
  text: string;
  time: string;
  foundAt: string;
  url?: string;
  author?: string;
  links?: string[];
  /** Benchmark items: Priors benchmarks the post's links or words already match. Empty means Priors has nothing like it. */
  matches?: BenchMatch[];
  /** Benchmark items: a linked site Priors already reads, so the scraper may only need a new board. */
  site?: KnownSite;
  /** Model names read in the post and where `normalizeLabel` files them. */
  names?: NameCheck[];
  /** A name lands on an existing model whose name lacks one of its words. */
  flagged?: boolean;
}

// "Index" and "arena" are boards (AA Intelligence Index, LMArena); "eval" covers evals and evaluations.
const BENCH_STRONG = /\b(benchmarks?|leaderboards?|evals?|evaluations?|arena|index)\b/i;
const BENCH_WEAK: [string, RegExp][] = [
  ["percent", /\d(\.\d+)?\s?%/], ["scores", /\bscor(e|es|ed|ing)\b/i], ["sota", /\b(sota|state[- ]of[- ]the[- ]art)\b/i],
  ["rank", /#\d+\b|\branks?\b|\branked\b/i], ["pareto", /\bpareto\b/i], ["elo", /\belo\b/i], ["results", /\bresults\b/i],
];
const LAUNCH = /\b(introducing|announcing|launch(es|ed|ing)?|releas(e|es|ed|ing)|now available|available (now|today|in)|rolling out|meet|is here|is out|out now|today we)\b/i;
const NEW_BENCH = /\bnew\s+(benchmark|leaderboard|eval|evaluation|arena|index)\b|\b(introducing|announcing|launching)\b[^.\n]{0,80}\b(benchmark|leaderboard|eval|evaluation|arena)\b/i;

/** Post text without its links: X shows "openai.com/index/introducing-..." inline, and "index" there is not a board. */
export function plainText(text: string, links: { text: string }[] = []): string {
  let t = text;
  for (const l of links) if (l.text) t = t.split(l.text).join(" ");
  return t.replace(/https?:\/\/\S+/g, " ").replace(/\b[\w-]+(\.[\w-]+)*\.(com|ai|org|io|dev|co|net)\/\S*/g, " ");
}

/** `boards`: names of Priors benchmarks the text mentions ("AA-Robotics"), a benchmark signal on their own. */
export function classify(text: string, names: string[], images = 0, boards: string[] = []): { kind: Kind; reasons: string[] } {
  const newBench = text.match(NEW_BENCH), launch = text.match(LAUNCH), strong = text.match(BENCH_STRONG);
  if (newBench) return { kind: "benchmark", reasons: [`new board: "${newBench[0]}"`] };
  if (launch && names.length) return { kind: "model", reasons: [`launch word "${launch[0]}"`, `model name ${names.join(", ")}`] };
  if (strong) return { kind: "benchmark", reasons: [`board word "${strong[0]}"`] };
  if (boards.length) return { kind: "benchmark", reasons: [`names a Priors board: ${boards.join(", ")}`] };
  const weak = BENCH_WEAK.filter(([, re]) => re.test(text)).map(([w]) => w);
  if (images) weak.push("image");
  if (weak.length >= 2 && weak.some((w) => w !== "image")) return { kind: "benchmark", reasons: weak };
  return { kind: "other", reasons: [] };
}

// Families a launch name starts with. "Claude Opus" before "Claude" and "Opus", so "Claude Opus 6" reads whole.
const FAMILY = "claude[\\s-]+(?:opus|sonnet|haiku|fable|mythos)|gpt|claude|opus|sonnet|haiku|fable|gemini|gemma|grok|deepseek|qwen|qwq|llama|mistral|magistral|devstral|codestral|ministral|kimi|glm|minimax|mimo|swe|muse|hy|step|nemotron|ling|ring|seed|doubao|ernie|composer|phi|jamba|nova|inkling|laguna|mercury|nex";
const NAME_RE = new RegExp(`\\b(${FAMILY})[\\s-]*([a-z]?\\d+(?:\\.\\d+)*[a-z]?)\\b((?:[ \\t-]+[A-Za-z]+){0,3})`, "gi");
/** Families that are also everyday words ("step 2", "seed 42"): they count only when capitalized. */
const PLAIN_WORDS = new Set(["step", "ring", "seed", "phi", "nova", "muse", "composer", "ling", "hy", "jamba", "mimo", "laguna", "mercury", "nex"]);
const O_SERIES = /\bo\d(?:[\s-]+(?:mini|pro))?\b/g;
/** Lowercase words that still belong to a name ("gpt-6 mini"); any other word must be capitalized to count ("Gemini 4 Hydrogen"). */
const TIER_LOWER = new Set(["mini", "nano", "pro", "flash", "lite", "max", "turbo", "fast", "heavy", "instant", "codex", "preview", "thinking", "ultra", "plus", "air"]);
/** Capitalized words that end a name: sentence words, verbs and board words that follow names in posts. */
const STOP = new Set(["a", "an", "and", "are", "as", "at", "beats", "benchmark", "by", "comes", "for", "from", "has", "have", "here", "hits", "in", "index", "intelligence", "is", "it", "joins", "leads", "leaderboard", "model", "models", "now", "of", "on", "or", "our", "out", "ranks", "scores", "sets", "takes", "that", "the", "this", "to", "today", "tops", "vs", "was", "we", "with", "api", "ai", "available", "arena", "launch", "release", "released", "achieves", "reaches", "trails"]);

/** Model names in a post, as written: "Gemini 4 Hydrogen", "GPT-6.2 Nova", "Claude Opus 6". A name needs a version number. */
export function extractModelNames(text: string): string[] {
  const out = new Map<string, string>();
  for (const m of text.matchAll(NAME_RE)) {
    if (PLAIN_WORDS.has(m[1].toLowerCase()) && !/^[A-Z]/.test(m[1])) continue;
    let name = m[0].slice(0, m[0].length - m[3].length);
    for (const [, sep, w] of m[3].matchAll(/([ \t-]+)([A-Za-z]+)/g)) {
      if (STOP.has(w.toLowerCase()) || !(TIER_LOWER.has(w.toLowerCase()) || /^[A-Z]/.test(w))) break;
      name += (sep.includes("-") ? "-" : " ") + w;
    }
    out.set(name.toLowerCase(), name);
  }
  for (const m of text.matchAll(O_SERIES)) out.set(m[0].toLowerCase(), m[0]);
  return [...out.values()];
}

const hostOf = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return ""; } };
const pathOf = (u: string) => { try { return new URL(u).pathname.replace(/\/+$/, ""); } catch { return ""; } };
const SOCIAL = new Set(["x.com", "twitter.com", "t.co", "youtube.com", "youtu.be", "linkedin.com"]);
/** A board name that cannot be an everyday word: several words, a hyphen or digit, CamelCase or an acronym ("Price" is not, "SpireClimb" is). */
const distinctive = (n: string) => n.length >= 5 && (/[\s\d-]/.test(n) || /[a-z][A-Z]/.test(n) || /^[A-Z]+$/.test(n));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Priors benchmarks a post points at: the same page (`url`) or the name in the text (`name`), at most 5, pages first; and a linked site Priors reads. */
export function matchBenchmarks(text: string, urls: string[], benchmarks: { id: string; name: string; shortName?: string; url: string }[]): { matches: BenchMatch[]; site?: KnownSite } {
  const found = new Map<string, BenchMatch>(), hosts = new Map<string, number>();
  const sites = urls.filter((u) => hostOf(u) && !SOCIAL.has(hostOf(u)));
  for (const b of benchmarks) {
    const bh = hostOf(b.url), bp = pathOf(b.url);
    const same = sites.filter((u) => hostOf(u) === bh);
    if (same.length) hosts.set(bh, (hosts.get(bh) ?? 0) + 1);
    if (bp && same.some((u) => pathOf(u) === bp || pathOf(u).startsWith(bp + "/"))) found.set(b.id, { id: b.id, name: b.name, by: "url" });
    if (found.has(b.id)) continue;
    for (const n of new Set([b.name, b.shortName, b.name.replace(/\s+v?\d+(\.\d+)*$/i, "")])) {
      if (n && distinctive(n) && new RegExp(`(^|[^\\w-])${esc(n)}($|[^\\w-])`, "i").test(text)) { found.set(b.id, { id: b.id, name: b.name, by: "name" }); break; }
    }
  }
  const matches = [...found.values()].sort((a, b) => (a.by === b.by ? 0 : a.by === "url" ? -1 : 1)).slice(0, 5);
  const [host, n] = [...hosts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return host ? { matches, site: { host, benchmarks: n! } } : { matches };
}

/** Seen state: item id -> first seen (ISO). Ids older than `keepDays` are dropped; posts that old are past the radar's age window anyway. */
export type Seen = Record<string, string>;
export function dedupe<T extends { id: string }>(items: T[], seen: Seen, now: Date, keepDays = 30): { fresh: T[]; seen: Seen } {
  const cutoff = now.getTime() - keepDays * 86_400_000, next: Seen = {};
  for (const [id, at] of Object.entries(seen)) if (Date.parse(at) >= cutoff) next[id] = at;
  const fresh: T[] = [];
  for (const it of items) if (!next[it.id]) { next[it.id] = now.toISOString(); fresh.push(it); }
  return { fresh, seen: next };
}

/** The `NEW_BENCHMARK` lines of the last finished run in the scrape log (from its `== <time> scrape` line to its `== done`). */
export function lastRunAnnouncements(log: string): string[] {
  const lines = log.split("\n"), done = lines.findLastIndex((l) => l.startsWith("== done"));
  if (done < 0) return [];
  let start = done - 1;
  while (start >= 0 && !(/^== \S+ scrape \d{4}-\d{2}-\d{2}/.test(lines[start]) || lines[start].startsWith("== done"))) start--;
  return [...new Set(lines.slice(start + 1, done).filter((l) => l.startsWith("NEW_BENCHMARK ")).map((l) => l.slice("NEW_BENCHMARK ".length).trim()))];
}

/** Post id from its status path ("/ArtificialAnlys/status/2121137661180256653") and the author handle. */
export function statusParts(status: string): { id: string; author: string } | undefined {
  const m = status.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
  return m ? { author: m[1], id: m[2] } : undefined;
}
