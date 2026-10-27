/**
 * Andon Labs evals. Vending-Bench 2 and Blueprint-Bench 2 expose server-rendered tables
 * (VB2 expands via a "Show more" button). Vending-Bench Arena reports per-round dollar
 * balances in prose; Butter-Bench and Drone-Bench render chart-only leaderboards, so the
 * scraper measures bar heights / labeled point positions against the published axis.
 */
import type { Page } from "playwright";
import type { RawRow, RawSeries, ScrapeResult, Source } from "../../../src/data/types";
import { ci, num } from "../harness";

const BASE = "https://andonlabs.com/evals";

interface EvalDef {
  slug: string;
  id: string;
  name: string;
  shortName: string;
  unit: "usd" | "percent";
  category: "agentic" | "reasoning" | "coding";
  kind: "table" | "rounds" | "bars" | "points";
  scale?: number;
  description: string;
  weight: number;
}

const EVALS: EvalDef[] = [
  {
    slug: "vending-bench-2", id: "vendingbench-2", name: "Vending-Bench 2", shortName: "Vending-Bench 2",
    unit: "usd", category: "agentic", kind: "table", weight: 5,
    description: "Year-long simulated vending-machine business; agents handle suppliers, inventory, pricing, and refunds. Score is the final bank balance.",
  },
  {
    slug: "vending-bench-arena", id: "vendingbench-arena", name: "Vending-Bench Arena", shortName: "VB Arena",
    unit: "usd", category: "agentic", kind: "rounds", weight: 4,
    description: "Multi-agent Vending-Bench 2: models run competing vending machines at one location, may trade or collude, and are scored individually on final balance.",
  },
  {
    slug: "blueprint-bench-2", id: "blueprintbench-2", name: "Blueprint-Bench 2", shortName: "Blueprint-Bench 2",
    unit: "percent", category: "reasoning", kind: "table", scale: 100, weight: 5,
    description: "Spatial reasoning: reconstruct 2D floor plans from ~20 apartment photos, scored on room connectivity and scale (random baseline normalized to 0).",
  },
  {
    slug: "butter-bench", id: "butterbench-v1", name: "Butter-Bench", shortName: "Butter-Bench",
    unit: "percent", category: "agentic", kind: "bars", weight: 4,
    description: "LLMs orchestrate a household robot through six 'pass the butter' subtasks; average task completion rate.",
  },
  {
    slug: "drone-bench", id: "dronebench-v1", name: "Drone-Bench", shortName: "Drone-Bench",
    unit: "percent", category: "coding", kind: "points", weight: 4,
    description: "Models write drone-surveillance code across five tasks (reconstruction, localization, navigation, detection, following); progress toward the human-authored baseline.",
  },
];

type TableRow = { label: string; value: number; ci?: [number, number] };

async function scrapeTable(page: Page, def: EvalDef): Promise<TableRow[]> {
  const more = page.locator('button:has-text("more")').first();
  if (await more.count()) await more.click().catch(() => {});
  await page.waitForTimeout(1200);
  const raw = await page.evaluate(() => {
    const rows: { label: string; cell: string }[] = [];
    for (const tr of document.querySelectorAll("table tr")) {
      const cells = [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim() ?? "");
      if (cells.length < 2) continue;
      const link = tr.querySelector("td a");
      const label = (link?.textContent ?? cells[1] ?? "").replace(/\s+/g, " ").replace(/\bNew\b$/, "").trim();
      const cell = cells[cells.length - 1];
      if (label && cell) rows.push({ label, cell });
    }
    return rows;
  });
  const out: TableRow[] = [];
  for (const r of raw) {
    const v = num(r.cell);
    if (v == null) continue;
    const range = ci(r.cell);
    out.push({ label: r.label, value: v * (def.scale ?? 1), ...(range ? { ci: range.map((x) => x * (def.scale ?? 1)) as [number, number] } : {}) });
  }
  return out;
}

/** "Claude Fable 5 - High" -> label and effort; the site's own run names carry the effort after a dash. */
export function splitRunLabel(name: string): { label: string; effort?: string } {
  const m = /^(.*?)\s+-\s+(none|minimal|low|medium|high|xhigh|max)$/i.exec(name.trim());
  return m ? { label: m[1], effort: m[2].toLowerCase() } : { label: name.trim() };
}

/**
 * Vending-Bench 2 ships its chart data in the page's JS bundle: a day grid, each run's average money balance per day,
 * and (in another chunk) each run's mean API cost for the simulated year. Read with patterns, never evaluated.
 */
export function parseVb2Bundle(chunks: string[]): { days: number[]; runs: { name: string; balance: number[]; final: number }[]; costs: Map<string, { meanCost: number; runs: number; outputTokens?: number }> } {
  let days: number[] = [];
  const runs: { name: string; balance: number[]; final: number }[] = [];
  const costs = new Map<string, { meanCost: number; runs: number; outputTokens?: number }>();
  const nums = (list: string) => list.split(",").map(Number).filter((x) => Number.isFinite(x));
  for (const js of chunks) {
    if (!days.length) { const g = /time_grid:\[([^\]]*)\]/.exec(js); if (g) days = nums(g[1]); }
    for (const m of js.matchAll(/"([^"]+)":\{num_epochs:[^{}]*?time_series:\[([^\]]*)\][^{}]*?final_value:([-\d.e+]+)/g)) {
      runs.push({ name: m[1], balance: nums(m[2]), final: Number(m[3]) });
    }
    for (const m of js.matchAll(/"([^"]+)":\{(provider:"[^"]*",n:\d+,mean_cost:[^}]*)\}/g)) {
      const field = (k: string) => { const f = new RegExp(`(?:^|,)${k}:([\\d.e+]+)`).exec(m[2]); return f ? Number(f[1]) : undefined; };
      const meanCost = field("mean_cost"), runs = field("n"), outputTokens = field("avg_output_tokens");
      if (meanCost != null) costs.set(m[1], { meanCost, runs: runs ?? 0, ...(outputTokens != null ? { outputTokens } : {}) });
    }
  }
  return { days, runs: runs.filter((r) => r.balance.length > 1), costs };
}

const MODELISH = /claude|gpt|gemini|grok|glm|kimi|qwen|deepseek|llama|mistral|minimax|ernie|nova|command|solar|opus|fable|sonnet|haiku|spark|muse|\bo[13]\b/i;
const cleanArenaLabel = (s: string) => s.trim().replace(/^(?:the )?(?:newly released )/i, "").trim();

async function scrapeRounds(page: Page): Promise<TableRow[]> {
  const text = await page.evaluate(() => document.body.innerText);
  const sections = text.split(/(?=Round #\d+)/).filter((s) => s.startsWith("Round #"));
  const latest = new Map<string, number>();
  const put = (label: string, raw: string) => {
    const name = cleanArenaLabel(label), v = num(raw);
    if (v != null && v > 100 && MODELISH.test(name)) latest.set(name, v);
  };
  for (const s of sections) {
    // "GPT-6 Astra won its first round with $12.4k" / "finished second with $7.0k"
    for (const m of s.matchAll(/([A-Z][\w. -]*?)\s+(?:won|finished)\b[^$]{0,80}?with (\$[\d.,]+k?)\b/g)) put(m[1], m[2]);
    // "ahead of GLM-5.3 ($7.8k)" / "behind GPT-5.6 Sol ($7.4k)"
    for (const m of s.matchAll(/(?:ahead of|behind|past)\s+([A-Z][\w. -]{2,}?)\s*\((\$[\d.,]+k?)\)/g)) put(m[1], m[2]);
    // "the $10.6k GPT-5.5 posted in Round #8"
    for (const m of s.matchAll(/(\$[\d.,]+k?)\s+([A-Z][\w. -]{2,}?)\s+(?:posted|reached)\b/g)) put(m[2], m[1]);
  }
  return [...latest.entries()].map(([label, value]) => ({ label, value }));
}

async function scrapeBars(page: Page): Promise<TableRow[]> {
  await page.waitForTimeout(2500);
  const raw = await page.evaluate(() => {
    const svg = [...document.querySelectorAll("svg")].find((s) => {
      const texts = [...s.querySelectorAll("text")].map((t) => t.textContent?.trim() ?? "");
      return texts.includes("100%") && texts.filter((t) => t.endsWith("%")).length >= 3 && texts.some((t) => t && !t.endsWith("%") && t.length > 2);
    });
    if (!svg) return null;
    const texts = [...svg.querySelectorAll("text")].map((t) => ({ t: t.textContent?.trim() ?? "", x: +(t.getAttribute("x") ?? 0), y: +(t.getAttribute("y") ?? 0) }));
    const ticks = texts.filter((t) => /^\d+%$/.test(t.t));
    const y0 = ticks.find((t) => t.t === "0%")?.y, y100 = ticks.find((t) => t.t === "100%")?.y;
    const labels = texts.filter((t) => t.t && !/%$/.test(t.t)).sort((a, b) => a.x - b.x);
    const bars = [...svg.querySelectorAll("rect")]
      .map((r) => ({ x: +(r.getAttribute("x") ?? 0), h: +(r.getAttribute("height") ?? 0), w: +(r.getAttribute("width") ?? 0), fill: r.getAttribute("fill") }))
      .filter((r) => r.h > 0.5 && r.w > 5 && r.fill)
      .sort((a, b) => a.x - b.x);
    return { y0, y100, labels: labels.map((l) => l.t), bars };
  });
  if (raw?.y0 == null || raw?.y100 == null || !raw.bars.length) return [];
  const plotH = raw.y0 - raw.y100;
  const out: TableRow[] = [];
  raw.bars.forEach((bar, i) => {
    const label = raw.labels[i];
    if (label) out.push({ label, value: (bar.h / plotH) * 100 });
  });
  return out;
}

async function scrapePoints(page: Page): Promise<TableRow[]> {
  const raw = await page.evaluate(() => {
    const svg = [...document.querySelectorAll("svg")].find((s) => s.textContent?.includes("Progress towards baseline"));
    if (!svg) return null;
    const texts = [...svg.querySelectorAll("text")].map((t) => ({ t: t.textContent?.trim() ?? "", x: +(t.getAttribute("x") ?? 0), y: +(t.getAttribute("y") ?? 0) }));
    const ticks = texts.filter((t) => /^\d+%$/.test(t.t));
    const y0 = ticks.find((t) => t.t === "0%")?.y, y100 = ticks.find((t) => t.t === "100%")?.y;
    const labels = texts.filter((t) => t.t && !/%$/.test(t.t) && !/baseline|Release|Progress|'/.test(t.t) && !/^[A-Z][a-z]{2}\s/.test(t.t));
    const circles = [...svg.querySelectorAll("circle")].map((c) => ({ cx: +(c.getAttribute("cx") ?? 0), cy: +(c.getAttribute("cy") ?? 0) }));
    return { y0, y100, labels, circles };
  });
  if (raw?.y0 == null || raw?.y100 == null) return [];
  const plotH = raw.y0 - raw.y100;
  const out: TableRow[] = [];
  for (const l of raw.labels) {
    // Point labels sit ~4px below their marker; nearest circle wins when one is close.
    const near = raw.circles.reduce((best, c) => {
      const d = Math.hypot(c.cx - l.x, c.cy - (l.y - 4));
      return !best || d < best.d ? { d, cy: c.cy } : best;
    }, null as { d: number; cy: number } | null);
    const py = near && near.d < 60 ? near.cy : l.y - 4;
    out.push({ label: l.t, value: ((raw.y0 - py) / plotH) * 100 });
  }
  return out;
}

const source: Source = {
  id: "andonlabs",
  name: "Andon Labs",
  url: "https://andonlabs.com/evals",
  async scrape(ctx): Promise<ScrapeResult> {
    const rows: RawRow[] = [];
    const series: RawSeries[] = [];
    const notes: string[] = [];
    const raw: Record<string, string> = {};
    for (const def of EVALS) {
      const url = `${BASE}/${def.slug}`;
      try {
        let scripts: string[] = [];
        const got = await ctx.withPage(url, async (page) => {
          if (def.id === "vendingbench-2") scripts = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\.js(\?|$)/.test(n)));
          return def.kind === "table" ? scrapeTable(page, def)
          : def.kind === "rounds" ? scrapeRounds(page)
          : def.kind === "bars" ? scrapeBars(page)
          : scrapePoints(page);
        });
        let bundle: ReturnType<typeof parseVb2Bundle> | undefined;
        if (scripts.length) {
          const chunks = (await Promise.all(scripts.map((u) => ctx.fetchText(u).catch(() => "")))).filter((js) => js.includes("time_series:[") || js.includes("mean_cost:"));
          bundle = parseVb2Bundle(chunks);
          for (const r of bundle.runs) {
            const { label, effort } = splitRunLabel(r.name);
            if (/^human\b/i.test(label) || bundle.days.length !== r.balance.length) continue;
            series.push({ benchmarkId: def.id, modelLabel: label, effort, x: bundle.days, y: r.balance, xLabel: "Day", yLabel: "Money balance ($)", sourceUrl: url });
          }
          notes.push(`${def.id}: ${bundle.runs.length} balance series, ${bundle.costs.size} run costs`);
        }
        for (const r of got) {
          if (/^human\b/i.test(r.label)) continue;
          const cost = bundle?.costs.get(r.label);
          rows.push({ benchmarkId: def.id, modelLabel: r.label, value: r.value, ci: r.ci, sourceUrl: url, ...(cost ? { costUsd: cost.meanCost, outputTokens: cost.outputTokens, note: `mean API cost of ${cost.runs} year-long runs` } : {}) });
        }
        notes.push(`${def.id}: ${got.length} rows`);
        raw[`${def.slug}.json`] = JSON.stringify(got);
      } catch (e) {
        notes.push(`${def.id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return {
      benchmarks: EVALS.map((def) => ({
        id: def.id, name: def.name, shortName: def.shortName, sourceId: this.id, url: `${BASE}/${def.slug}`,
        description: def.description, unit: def.unit, higherIsBetter: true, category: def.category,
        eligibleForDefault: true, defaultWeight: def.weight,
      })),
      rows,
      series,
      raw,
      notes,
    };
  },
};
export default source;
