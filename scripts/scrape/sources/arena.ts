/**
 * Arena.ai (formerly LMArena). LLM leaderboards only (no image/video/media generation):
 *   agent   — Agent Arena "net improvement" (causal-tracing metric, %, ± CI). Not an Elo.
 *   text, webdev, search, vision, document, image-to-webdev — Bradley-Terry/Elo-style ratings.
 * Each leaderboard page is Next.js; the full row set is embedded in the RSC flight payload
 * (`"snapshot":{...rows}` for agent, `"leaderboard":{...entries}` for the others).
 */
import type { Source, ScrapeResult, ScrapeContext, RawRow, Benchmark, BenchmarkCategory } from "../../../src/data/types";
import { rscText, extractKeyed } from "./_rsc";

const SITE = "https://arena.ai";

interface AgentRow {
  rank: number; model: string; modelOrganization?: string; sessions?: number;
  avgScore: { value: number; ci?: number }; rankSpread?: { min: number; max: number };
  signalScores?: Record<string, number>;
}
interface AgentSnapshot { lastUpdated?: string; totalSessions?: number; modelCount?: number; rows: AgentRow[]; signals?: { name: string; displayName: string }[] }
interface EloEntry {
  rank: number; rankUpper?: number; rankLower?: number; modelKey: string; modelDisplayName: string;
  rating: number; ratingUpper?: number; ratingLower?: number; votes?: number; modelOrganization?: string;
}
interface EloBoard { arenaSlug: string; leaderboardSlug: string; params?: Record<string, unknown>; voteCutoffISOString?: string; totalVotes?: number; totalModels?: number; entries: EloEntry[] }

const ELO_BOARDS: { id: string; path: string; name: string; category: BenchmarkCategory; desc: string; weight: number }[] = [
  { id: "arena-text", path: "/leaderboard/text", name: "Arena Text", category: "composite", weight: 5,
    desc: "Crowdsourced pairwise human preference on open-ended text prompts (style control on); Bradley-Terry rating." },
  { id: "arena-text-multi-turn", path: "/leaderboard/text/multi-turn", name: "Arena Text — Multi-Turn", category: "composite", weight: 0,
    desc: "Crowdsourced pairwise human preference restricted to multi-turn conversations (style control on); Bradley-Terry rating." },
  { id: "arena-webdev", path: "/leaderboard/code/webdev", name: "Arena WebDev", category: "coding", weight: 5,
    desc: "Human preference between agentic front-end web development outputs; Bradley-Terry rating." },
  { id: "arena-search", path: "/leaderboard/search", name: "Arena Search", category: "knowledge", weight: 0,
    desc: "Human preference among LLMs with integrated web search; Bradley-Terry rating." },
  { id: "arena-vision", path: "/leaderboard/vision", name: "Arena Vision", category: "other", weight: 0,
    desc: "Human preference on prompts with image inputs (multimodal understanding); Bradley-Terry rating." },
  { id: "arena-document", path: "/leaderboard/document", name: "Arena Document", category: "long-context", weight: 0,
    desc: "Human preference on document analysis and long-content reasoning; Bradley-Terry rating." },
  { id: "arena-image-to-webdev", path: "/leaderboard/code/image-to-webdev", name: "Arena Image-to-WebDev", category: "coding", weight: 0,
    desc: "Human preference on generating websites from screenshots/images with agentic coding; Bradley-Terry rating." },
];

/** WebDev labels sometimes carry a harness suffix like "gpt-5.6-sol-xhigh (codex-harness)". */
function splitHarness(label: string): { label: string; harness?: string } {
  const m = label.match(/^(.*?)\s*\(([a-z0-9-]*harness[a-z0-9-]*)\)\s*$/i);
  return m ? { label: m[1], harness: m[2] } : { label };
}

const AGENT_DESCRIPTION = "Arena.ai Agent Arena: causal 'net improvement' a model contributes to real-world agentic sessions (task success, praise vs complaint, steerability, bash recovery, tool hallucination), estimated from millions of live Agent Mode sessions. Percent with 95% CI; not an Elo.";
const agentBenchmark = (url: string, advanced: { id: string; name: string }[]): Benchmark => ({
  id: "arena-agent", name: "Agent Arena", shortName: "Agent Arena", sourceId: "arena", url,
  description: AGENT_DESCRIPTION,
  unit: "percent", higherIsBetter: true, category: "agentic", eligibleForDefault: true, defaultWeight: 10, advanced,
});

/**
 * arena.ai answers scripted requests with a Cloudflare challenge (403). The same leaderboards are
 * published as the Hugging Face dataset lmarena-ai/leaderboard-dataset: one small parquet file per
 * board (`<config>/latest-*.parquet`), read with hyparquet, keeping the "overall" category. Multi-Turn and
 * Image-to-WebDev are not in the dataset, so they are skipped while the site is blocked.
 */
const HF_REPO = "https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset";
const HF_BOARDS: Record<string, string> = { "arena-text": "text_style_control", "arena-webdev": "webdev", "arena-search": "search", "arena-vision": "vision_style_control", "arena-document": "document" };
interface HfRow { model_name: string; organization?: string; rating?: number; rating_lower?: number; rating_upper?: number; vote_count?: number; rank?: number; score?: number; score_ci_lower?: number; score_ci_upper?: number; session_count?: number; leaderboard_publish_date?: string }

/** Parquet integers come back as BigInt. */
const plain = (row: Record<string, unknown>): HfRow => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v])) as unknown as HfRow;

async function hfRows(config: string): Promise<HfRow[]> {
  const { parquetReadObjects } = await import("hyparquet");
  const get = async (url: string) => {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60_000), headers: { "user-agent": "Mozilla/5.0 priors-scraper" } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res;
  };
  let path = `${config}/latest-00000-of-00001.parquet`;
  try { await get(`${HF_REPO}/resolve/main/${path}`).then((r) => r.body?.cancel()); }
  catch {
    // A sharded or renamed file: ask the repo for this board's "latest" file.
    const tree = await (await get(`https://huggingface.co/api/datasets/lmarena-ai/leaderboard-dataset/tree/main/${config}`)).json() as { path: string }[];
    const found = tree.find((f) => /\/latest-.*\.parquet$/.test(f.path));
    if (!found) throw new Error(`no latest parquet for ${config}`);
    path = found.path;
  }
  const buf = await (await get(`${HF_REPO}/resolve/main/${path}`)).arrayBuffer();
  return (await parquetReadObjects({ file: buf }) as Record<string, unknown>[]).filter((r) => r.category === "overall").map(plain);
}

export function parseArenaDataset(boards: Record<string, HfRow[]>): Pick<ScrapeResult, "benchmarks" | "rows" | "notes"> {
  const rows: RawRow[] = [], benchmarks: Benchmark[] = [], notes: string[] = [];
  const agent = boards["arena-agent"];
  if (agent?.length) {
    const url = `${SITE}/leaderboard/agent`;
    for (const r of agent) {
      if (!Number.isFinite(r.score)) continue;
      const v = r.score! * 100;
      rows.push({ benchmarkId: "arena-agent", modelLabel: r.model_name, value: v, rank: r.rank, sourceUrl: url, labHint: r.organization,
        ci: r.score_ci_lower != null && r.score_ci_upper != null ? [r.score_ci_lower * 100, r.score_ci_upper * 100] : undefined,
        note: `${r.session_count ?? "?"} sessions; Hugging Face dataset lmarena-ai/leaderboard-dataset, published ${r.leaderboard_publish_date ?? "?"}` });
    }
    benchmarks.push(agentBenchmark(url, []));
    notes.push(`agent: ${agent.length} rows (dataset)`);
  }
  for (const b of ELO_BOARDS) {
    const data = boards[b.id];
    if (!data?.length) continue;
    const url = `${SITE}${b.path}`;
    for (const r of data) {
      if (!Number.isFinite(r.rating)) continue;
      const { label, harness } = splitHarness(r.model_name);
      rows.push({ benchmarkId: b.id, modelLabel: label, value: r.rating!, rank: r.rank, harness, sourceUrl: url, labHint: r.organization,
        ci: r.rating_lower != null && r.rating_upper != null ? [r.rating_lower, r.rating_upper] : undefined,
        note: `${r.vote_count ?? "?"} votes; Hugging Face dataset lmarena-ai/leaderboard-dataset, published ${r.leaderboard_publish_date ?? "?"}` });
    }
    benchmarks.push({ id: b.id, name: b.name, sourceId: "arena", url, description: b.desc, unit: "elo", higherIsBetter: true, category: b.category, eligibleForDefault: b.weight > 0, defaultWeight: b.weight });
    notes.push(`${b.id}: ${data.length} rows (dataset)`);
  }
  if (!rows.length) throw new Error("Arena dataset returned no rows");
  return { benchmarks, rows, notes };
}

async function scrapeDataset(ctx: ScrapeContext): Promise<ScrapeResult> {
  const boards: Record<string, HfRow[]> = {};
  const raw: Record<string, string> = {};
  for (const [id, config] of Object.entries({ "arena-agent": "agent", ...HF_BOARDS })) {
    try { boards[id] = await hfRows(config); raw[`${config}.json`] = JSON.stringify(boards[id]); }
    catch (e) { ctx.log(`${id} dataset skipped: ${e instanceof Error ? e.message : String(e)}`); }
  }
  return { ...parseArenaDataset(boards), raw };
}

const source: Source = {
  id: "arena",
  name: "Arena.ai",
  url: `${SITE}/leaderboard`,
  async scrape(ctx): Promise<ScrapeResult> {
    const rows: RawRow[] = [];
    const raw: Record<string, string> = {};
    const notes: string[] = [];
    const benchmarks: Benchmark[] = [];

    // ---- Agent Arena
    const agentUrl = `${SITE}/leaderboard/agent`;
    let agentHtml: string;
    try { agentHtml = await ctx.fetchText(agentUrl); }
    catch (e) {
      // Blocked (403 challenge): read the published dataset instead.
      ctx.log(`arena.ai not reachable (${e instanceof Error ? e.message : String(e)}); reading the Hugging Face dataset`);
      return scrapeDataset(ctx);
    }
    raw["agent.html"] = agentHtml;
    const snap = extractKeyed<AgentSnapshot>(rscText(agentHtml), "snapshot").find((s) => Array.isArray(s?.rows) && s.rows.length);
    if (!snap) throw new Error("Agent Arena: snapshot not found in RSC payload");
    raw["agent-snapshot.json"] = JSON.stringify(snap, null, 2);
    for (const r of snap.rows) {
      const v = r.avgScore?.value;
      if (v == null || !Number.isFinite(v)) continue;
      const c = r.avgScore.ci;
      rows.push({
        benchmarkId: "arena-agent",
        modelLabel: r.model,
        value: v * 100,
        ci: c != null ? [(v - c) * 100, (v + c) * 100] : undefined,
        rank: r.rank,
        sourceUrl: agentUrl,
        labHint: r.modelOrganization,
        note: `${r.sessions ?? "?"} sessions; rank spread ${r.rankSpread?.min ?? "?"}-${r.rankSpread?.max ?? "?"}`,
      });
    }
    notes.push(`agent: ${snap.rows.length} rows (updated ${snap.lastUpdated ?? "?"})`);
    benchmarks.push(agentBenchmark(agentUrl, (snap.signals ?? []).map((x) => ({ id: x.name, name: x.displayName }))));

    // ---- Elo-style boards
    for (const b of ELO_BOARDS) {
      const url = `${SITE}${b.path}`;
      try {
        const html = await ctx.fetchText(url);
        raw[`${b.id}.html`] = html;
        const board = extractKeyed<EloBoard>(rscText(html), "leaderboard").find((x) => Array.isArray(x?.entries) && x.entries.length && "rating" in x.entries[0]);
        if (!board) throw new Error("no leaderboard entries in RSC payload");
        raw[`${b.id}.json`] = JSON.stringify(board, null, 2);
        for (const e of board.entries) {
          if (!Number.isFinite(e.rating)) continue;
          const { label, harness } = splitHarness(e.modelDisplayName);
          rows.push({
            benchmarkId: b.id,
            modelLabel: label,
            value: e.rating,
            ci: e.ratingLower != null && e.ratingUpper != null ? [e.ratingLower, e.ratingUpper] : undefined,
            rank: e.rank,
            harness,
            sourceUrl: url,
            labHint: e.modelOrganization,
            note: `${e.votes ?? "?"} votes${e.rankUpper != null && e.rankLower != null ? `; rank ${e.rankUpper}-${e.rankLower}` : ""}${board.params?.styleControl ? "; style control" : ""}`,
          });
        }
        benchmarks.push({
          id: b.id, name: b.name, sourceId: this.id, url, description: b.desc,
          unit: "elo", higherIsBetter: true, category: b.category, eligibleForDefault: b.weight > 0, defaultWeight: b.weight,
        });
        notes.push(`${b.id}: ${board.entries.length} rows (votes to ${board.voteCutoffISOString ?? "?"})`);
      } catch (e) {
        notes.push(`${b.id} skipped: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return { benchmarks, rows, raw, notes };
  },
};
export default source;
