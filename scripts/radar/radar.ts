/**
 * Bench radar: one pass over the places a new benchmark or model shows up first, so a scraper can be drafted before anyone asks.
 * `npm run radar`. The launchd job `com.adam.priors-radar` runs it every 30 minutes (template beside this file).
 *
 * Reads (1) recent posts from the accounts below on X, through the agent-owned signed-in Chrome on the Linux box (`x-collect.mjs`,
 * copied there, run and deleted), and (2) the `NEW_BENCHMARK` lines of the scrape job's last run. New benchmark and model items go
 * to `~/priors/radar/inbox.json`, every item it has looked at to `seen.json`, and a macOS notification goes out once per new
 * benchmark post and once per launch name that `normalizeLabel` files under an existing model (see `name-check.ts`).
 * Override the accounts with one handle per line in `~/priors/radar/accounts.txt`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, openSync, readSync, fstatSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classify, dedupe, extractModelNames, lastRunAnnouncements, matchBenchmarks, plainText, statusParts, type InboxItem, type Post, type Seen } from "./classify";
import { checkName, describeCheck, isFlagged, loadSnapshot } from "./name-check";

const ACCOUNTS = ["ArtificialAnlys", "ValsAI", "mercor", "EpochAIResearch", "arena", "scale_AI", "OpenAI", "AnthropicAI", "GoogleDeepMind", "xai", "deepseek_ai", "Alibaba_Qwen", "MistralAI", "cognition", "theo"];
const HOME = homedir();
const DIR = process.env.PRIORS_RADAR_DIR || path.join(HOME, "priors/radar");
const SCRAPE_LOG = process.env.PRIORS_SCRAPE_LOG || path.join(HOME, "priors/logs/scrape.log");
const ANNOUNCED = process.env.PRIORS_ANNOUNCED_FILE || path.join(HOME, "priors/logs/announced-benchmarks.txt");
const HOST = process.env.PRIORS_RADAR_HOST || "adams-linux";
const SCROLLS = Number(process.env.PRIORS_RADAR_SCROLLS) || 3;
const MAX_AGE_DAYS = Number(process.env.PRIORS_RADAR_MAX_AGE_DAYS) || 3;
/** More than this many notifications in one pass collapse into one, so a backlog never floods the screen. */
const MAX_NOTES = 5;

/** `named`: flagged "name -> id" pairs already notified, so a known one (Kimi K3.1 Pro on `kimi-k3.1`) notifies once, not on every post. */
interface State { seen: Seen; xError?: string; named?: string[] }

const log = (...a: unknown[]) => console.log(`[radar ${new Date().toISOString()}]`, ...a);
const readJson = <T>(file: string, fallback: T): T => { try { return JSON.parse(readFileSync(file, "utf8")) as T; } catch { return fallback; } };
function writeJson(file: string, value: unknown) { const tmp = `${file}.${process.pid}.tmp`; writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n"); renameSync(tmp, file); }
/** Text goes in as argv, never into the AppleScript source (as `notify()` in scripts/ops/daily-scrape.sh). */
function notify(text: string) { try { execFileSync("osascript", ["-e", "on run argv", "-e", 'display notification (item 1 of argv) with title "Priors radar"', "-e", "end run", "--", text], { stdio: "ignore" }); } catch { /* no notification is not a failed pass */ } }
const excerpt = (t: string, n = 280) => { const s = t.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function accounts(): string[] {
  const file = path.join(DIR, "accounts.txt");
  const list = existsSync(file) ? readFileSync(file, "utf8").split("\n").map((l) => l.replace(/#.*/, "").trim()).filter(Boolean) : ACCOUNTS;
  return list.filter((h) => /^[A-Za-z0-9_]{1,15}$/.test(h));
}

/** The last few MB of the scrape log: it is far larger than one run. */
function logTail(file: string, bytes = 4_000_000): string {
  if (!existsSync(file)) return "";
  const fd = openSync(file, "r");
  try { const size = fstatSync(fd).size, len = Math.min(bytes, size), buf = Buffer.alloc(len); readSync(fd, buf, 0, len, size - len); return buf.toString("utf8"); } finally { closeSync(fd); }
}

function collectX(handles: string[]): { profiles: { handle: string; posts: Post[] }[]; errors: string[] } {
  const remote = `priors-radar-${process.pid}.mjs`, local = fileURLToPath(new URL("./x-collect.mjs", import.meta.url));
  execFileSync("scp", ["-q", local, `${HOST}:agent-x/${remote}`], { timeout: 60_000 });
  // Handles are checked against X's handle pattern above, so they are safe in the remote command line. The script is deleted however the run ends.
  const out = execFileSync("ssh", [HOST, `cd ~/agent-x && timeout ${60 + handles.length * 25} node ${remote} ${SCROLLS} ${handles.join(" ")}; s=$?; rm -f ${remote}; exit $s`], { timeout: (90 + handles.length * 25) * 1000, maxBuffer: 64 << 20 }).toString();
  return JSON.parse(out.trim().split("\n").pop()!);
}

/** t.co links resolved to where they go, one request each without following on. Unresolvable ones stay as they are. */
async function resolveLinks(hrefs: string[]): Promise<string[]> {
  return Promise.all([...new Set(hrefs)].map(async (h) => {
    if (!h.startsWith("https://t.co/")) return h;
    try { const r = await fetch(h, { redirect: "manual", signal: AbortSignal.timeout(8000) }); return r.headers.get("location") || h; } catch { return h; }
  }));
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  const stateFile = path.join(DIR, "seen.json"), inboxFile = path.join(DIR, "inbox.json");
  const baseline = !existsSync(stateFile);
  const state = readJson<State>(stateFile, { seen: {} }), inbox = readJson<InboxItem[]>(inboxFile, []);
  const snapshot = loadSnapshot(), now = new Date(), foundAt = now.toISOString();
  const candidates: InboxItem[] = [], others: string[] = [], named = new Set(state.named ?? []);
  const notes: string[] = [];

  // 1. X.
  const handles = accounts();
  let xError: string | undefined;
  try {
    const { profiles, errors } = collectX(handles);
    if (errors.length) log("x errors:", errors.join("; "));
    if (profiles.every((p) => !p.posts.length)) xError = errors[0] ?? "no posts read from any profile";
    for (const p of profiles) {
      log(`x @${p.handle}: ${p.posts.length} posts`);
      for (const post of p.posts) {
        const parts = statusParts(post.status);
        if (!parts || !post.time || now.getTime() - Date.parse(post.time) > MAX_AGE_DAYS * 86_400_000) continue;
        const text = plainText(post.text, post.links), names = extractModelNames(text);
        const boards = matchBenchmarks(text, [], snapshot.benchmarks).matches.map((m) => m.name);
        const { kind, reasons } = classify(text, names, post.images, boards);
        candidates.push({ id: `x:${parts.id}`, source: "x", kind, reasons, text: excerpt(post.text), time: post.time, foundAt, url: `https://x.com/${parts.author}/status/${parts.id}`, author: parts.author, links: post.links.map((l) => l.href), ...(names.length ? { names: names.map((n) => checkName(n, snapshot.models)) } : {}) });
      }
    }
  } catch (e) {
    xError = String((e as Error).message ?? e).split("\n")[0];
  }
  if (xError) log("x failed:", xError);
  if (xError && !state.xError) notes.push(`Radar cannot read X: ${xError}`);
  if (!xError && state.xError) log("x reading again");

  // 2. The scrape job's announcements. The job itself notifies on each the first time, so these notify only if it has not.
  const announced = new Set(existsSync(ANNOUNCED) ? readFileSync(ANNOUNCED, "utf8").split("\n").map((l) => l.trim()) : []);
  for (const item of lastRunAnnouncements(logTail(SCRAPE_LOG))) {
    candidates.push({ id: `log:${item}`, source: "scrape-log", kind: "benchmark", reasons: ["scrape log NEW_BENCHMARK"], text: item, time: foundAt, foundAt, links: item.match(/https?:\/\/\S+/g) ?? [] });
  }

  const { fresh, seen } = dedupe(candidates, state.seen, now);
  const added: InboxItem[] = [];
  for (const it of fresh) {
    const swallowed = it.names?.filter(isFlagged) ?? [];
    // A post about something else still counts when a model name in it would be swallowed.
    if (it.kind === "other" && !swallowed.length) { others.push(`${it.url} ${excerpt(it.text, 100)}`); continue; }
    if (it.source === "x" && it.links?.length) it.links = await resolveLinks(it.links);
    if (it.kind === "benchmark") Object.assign(it, matchBenchmarks(it.text, it.links ?? [], snapshot.benchmarks));
    if (swallowed.length) it.flagged = true;
    added.push(it);
    if (it.kind === "benchmark" && (it.source === "x" || !announced.has(`NEW_BENCHMARK ${it.text}`))) {
      notes.push(`${it.source === "x" ? `Benchmark post by @${it.author}` : "New benchmark"}${it.matches?.length ? "" : it.site ? ` (new on ${it.site.host})` : " (not in Priors)"}: ${excerpt(it.text, 120)}`);
    }
    for (const n of swallowed) {
      const pair = `${n.name.toLowerCase()} -> ${n.modelId}`;
      if (named.has(pair)) continue;
      named.add(pair);
      notes.push(`"${n.name}" files under ${n.modelId}${n.existingName ? ` (${n.existingName})` : ""}: check normalize.ts`);
    }
  }
  for (const o of others) log("other:", o);
  for (const it of added) {
    log(`${it.kind}${it.flagged ? " FLAGGED" : ""}: ${it.url ?? it.text}${it.matches?.length ? ` matches ${it.matches.map((m) => `${m.id}(${m.by})`).join(", ")}` : ""}${it.site && !it.matches?.length ? ` new on ${it.site.host} (${it.site.benchmarks} benchmarks there)` : ""}`);
    for (const n of it.names ?? []) log("  " + describeCheck(n).replace(/\n/g, "\n  "));
  }

  writeJson(inboxFile, [...inbox, ...added]);
  writeJson(stateFile, { seen, ...(xError ? { xError } : {}), named: [...named] } satisfies State);
  log(`pass done: ${candidates.length} read, ${fresh.length} new, ${added.length} to inbox (${added.filter((i) => i.kind === "benchmark").length} benchmark, ${added.filter((i) => i.kind === "model").length} model, ${added.filter((i) => i.flagged).length} flagged), ${others.length} other`);

  // The first pass records what is already out there; one line says so instead of one notification per old post.
  if (baseline) notify(`Radar started: ${added.length} items in inbox.json${added.some((i) => i.flagged) ? ", some flagged" : ""}`);
  else if (notes.length > MAX_NOTES) notify(`${notes.length} new radar items, see ~/priors/radar/inbox.json. First: ${notes[0]}`);
  else for (const n of notes) notify(n);
}

main().catch((e) => { log("failed:", e); process.exit(1); });
