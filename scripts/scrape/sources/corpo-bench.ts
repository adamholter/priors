/**
 * Corpo-Bench (local-bench.ai): 14 consulting-style tasks, each ending in a finished deliverable (a note, letter, minutes, register, workbook
 * or deck), marked out of 10 by two graders who do not see model names, times 10. The Corpo Index is the mean of two roles with equal
 * weight: Solo (the model does the task alone) and Orchestrator (it writes one work order and a fixed GPT-6 Luna worker does the work).
 * A third role, Worker (a fixed Opus 5.5 orchestrator writes the order and reviews once), is published but is not in the index.
 *
 * Each model runs in one harness (Claude Code, Codex, Antigravity, ...), so a score belongs to the model and its harness. The site is
 * server-rendered: the home page lists the models and each model's page gives its lab, harness, effort, the index with its 95% range,
 * and one row per role. Local rows (quantized or modified weights on one RTX 5090) are left out: they are not the provider's model.
 * Cost is the model's own cost a task at list price; a cost the site marks "≥" is only a lower bound and is kept out of `costUsd`.
 */
import type { Benchmark, RawRow, ScrapeResult, Source } from "../../../src/data/types";

export const CORPO_ID = "corpo-index";
const SITE = "https://local-bench.ai/";
const ROLES = [["Solo", "solo"], ["Orchestrator", "orchestrator"], ["Worker", "worker"]] as const;
type Role = (typeof ROLES)[number][0];

export type RoleScore = { value: number; ci?: [number, number]; cost?: number; costAtLeast?: boolean; partnerCost?: number; minutes?: number; attempts?: number; tasks?: number };
export type CorpoModel = {
  slug: string; name: string; lab: string; harness: string; effort?: string; local: boolean;
  index: number; ci?: [number, number]; cost?: number; costAtLeast?: boolean; minutes?: number; roles: Partial<Record<Role, RoleScore>>;
};

const text = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const num = (s: string | undefined) => (s === undefined ? undefined : Number(s.replace(/,/g, "")));
const range = (s: string): [number, number] | undefined => { const m = s.match(/\((-?[\d.]+) to (-?[\d.]+)\)/); return m ? [Number(m[1]), Number(m[2])] : undefined; };
const money = (s: string) => { const m = s.match(/(≥|&ge;)?\s*\$([\d.,]+)/); return m ? { cost: num(m[2]), atLeast: !!m[1] } : { cost: undefined, atLeast: false }; };

/** The model pages linked from the Corpo Index board, in its order, and the data date in the footer. */
export function parseCorpoHome(html: string): { slugs: string[]; date?: string } {
  const board = html.match(/<section[^>]*data-board="corpo"[\s\S]*?<\/section>/)?.[0];
  if (!board) throw new Error("Corpo-Bench: Corpo Index board missing from the home page");
  const slugs = [...new Set([...board.matchAll(/<a class="row\b[^"]*" href="\/models\/([^"/]+)\/"/g)].map((m) => m[1]))];
  if (!slugs.length) throw new Error("Corpo-Bench: no model rows on the home page");
  return { slugs, date: footerDate(html) };
}

function footerDate(html: string): string | undefined {
  const m = text(html).match(/Data from (\d{1,2}) ([A-Z][a-z]{2})[a-z]* (\d{4})/);
  if (!m) return undefined;
  const month = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[2]) / 3 + 1;
  return month > 0 ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : undefined;
}

/** One model's page: the heading, the "lab · harness · effort · cloud" line, the index and the role table. */
export function parseCorpoModel(html: string, slug: string): CorpoModel {
  const name = text(html.match(/<div class="mhead"[\s\S]*?<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const lede = text(html.match(/<div class="mhead"[\s\S]*?<p class="lede">([\s\S]*?)<\/p>/)?.[1] ?? "").split(" · ");
  const big = text(html.match(/<p class="big">([\s\S]*?)<\/p>/)?.[1] ?? "");
  const facts = text(html.match(/<p class="facts">([\s\S]*?)<\/p>/)?.[1] ?? "");
  const index = num(big.match(/Corpo Index\s+(-?[\d.]+)/)?.[1]);
  if (!name || lede.length < 3 || index === undefined || !Number.isFinite(index)) throw new Error(`Corpo-Bench: model page ${slug} changed`);
  const effort = lede.find((p) => / effort$/.test(p))?.replace(/ effort$/, "") ?? name.match(/\((\w+) effort\)/)?.[1];
  const roles: CorpoModel["roles"] = {};
  for (const row of html.matchAll(/<tr><th scope="row">([^<]+)<\/th>([\s\S]*?)<\/tr>/g)) {
    const role = ROLES.find(([r]) => r === row[1].trim())?.[0];
    if (!role) continue;
    const cells = [...row[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => text(c[1]));
    // A role still running shows an estimate ("~67.1 (estimate)", 5 of 14 tasks): partial, so it is left out. A missing Solo or Orchestrator then fails below.
    if (/^~|\(estimate\)/.test(cells[0] ?? "")) continue;
    const value = num(cells[0]?.match(/^-?[\d.]+/)?.[0]);
    if (value === undefined || !Number.isFinite(value)) throw new Error(`Corpo-Bench: ${slug} ${role} score unreadable`);
    const [own, partner] = (cells[1] ?? "").split("+");
    const { cost, atLeast } = money(own ?? "");
    roles[role] = { value, ci: range(cells[0]), cost, costAtLeast: atLeast, partnerCost: money(partner ?? "").cost, minutes: num(cells[2]), attempts: num(cells[3]), tasks: num(cells[4]) };
  }
  if (!roles.Solo || !roles.Orchestrator) throw new Error(`Corpo-Bench: ${slug} is missing a Corpo Index role`);
  const headline = money(facts.match(/^[^·]*own cost a task/)?.[0] ?? "");
  return {
    slug, name: name.replace(/\s*\(\w+ effort\)\s*$/, "").replace(/\s+·\s+.*$/, ""), lab: lede[0], harness: lede[1], effort,
    local: lede[lede.length - 1] === "local", index, ci: range(big), cost: headline.cost, costAtLeast: headline.atLeast,
    minutes: num(facts.match(/([\d.]+) own minutes a task/)?.[1]), roles,
  };
}

const DESCRIPTION = "14 consulting-style tasks that each end in a finished deliverable, marked by two blind graders out of 10, times 10.";

export function corpoResult(models: CorpoModel[], date?: string): { benchmarks: Benchmark[]; rows: RawRow[]; skipped: string[] } {
  const base = { sourceId: "corpo-bench", url: SITE, unit: "score", normalization: { kind: "linear", min: 0, max: 100 }, higherIsBetter: true, category: "professional", categories: ["professional", "agentic"], eligibleForDefault: false, defaultWeight: 0, versionPolicy: { kind: "fresh" }, ...(date ? { lastUpdated: date } : {}) } satisfies Partial<Benchmark>;
  const benchmarks: Benchmark[] = [
    { ...base, id: CORPO_ID, name: "Corpo Index", shortName: "Corpo Index", description: `${DESCRIPTION} The mean of the Solo and Orchestrator roles, each model in its own harness.` },
    { ...base, id: `${CORPO_ID}-solo`, name: "Corpo Index: Solo", shortName: "Corpo Solo", description: `${DESCRIPTION} The model does each task alone.`, variantOf: CORPO_ID, variantLabel: "Solo" },
    { ...base, id: `${CORPO_ID}-orchestrator`, name: "Corpo Index: Orchestrator", shortName: "Corpo Orchestrator", description: `${DESCRIPTION} The model plans each task and writes one work order; a fixed GPT-6 Luna worker does the work with no review.`, variantOf: CORPO_ID, variantLabel: "Orchestrator" },
    { ...base, id: `${CORPO_ID}-worker`, name: "Corpo-Bench: Worker", shortName: "Corpo Worker", description: `${DESCRIPTION} A fixed Opus 5.5 orchestrator writes the work order and reviews the result once; the model does the work. Not in the Corpo Index.`, variantOf: CORPO_ID, variantLabel: "Worker" },
  ];
  const rows: RawRow[] = [], skipped: string[] = [];
  for (const m of models) {
    if (m.local) { skipped.push(`${m.name} (local, ${m.harness})`); continue; }
    const sourceUrl = `${SITE}models/${m.slug}/`;
    const common = { modelLabel: m.name, labHint: m.lab, ...(m.effort ? { effort: m.effort } : {}), sourceUrl };
    const cost = (c: number | undefined, atLeast: boolean | undefined) => (typeof c === "number" && c > 0 && !atLeast ? { costUsd: c } : {});
    rows.push({ ...common, benchmarkId: CORPO_ID, value: m.index, ...(m.ci ? { ci: m.ci } : {}), ...cost(m.cost, m.costAtLeast), note: `In ${m.harness}; own cost a task`, details: { harness: m.harness, ownMinutesPerTask: m.minutes, ...(m.costAtLeast ? { costAtLeastUsd: m.cost } : {}) } });
    for (const [role, key] of ROLES) {
      const r = m.roles[role];
      if (!r) continue;
      rows.push({ ...common, benchmarkId: `${CORPO_ID}-${key}`, value: r.value, ...(r.ci ? { ci: r.ci } : {}), ...cost(r.cost, r.costAtLeast), note: `In ${m.harness}; ${r.attempts ?? "?"} attempts over ${r.tasks ?? "?"} tasks`, details: { harness: m.harness, ownMinutesPerTask: r.minutes, attempts: r.attempts, tasks: r.tasks, ...(r.partnerCost !== undefined ? { partnerCostUsd: r.partnerCost } : {}), ...(r.costAtLeast ? { costAtLeastUsd: r.cost } : {}) } });
    }
  }
  return { benchmarks, rows, skipped };
}

const source: Source = {
  id: "corpo-bench", name: "Corpo-Bench", url: SITE,
  async scrape(ctx): Promise<ScrapeResult> {
    const home = await ctx.fetchText(SITE);
    const { slugs, date } = parseCorpoHome(home);
    const raw: Record<string, string> = { "index.html": home };
    const models: CorpoModel[] = [];
    for (let i = 0; i < slugs.length; i += 4) {
      const pages = await Promise.all(slugs.slice(i, i + 4).map(async (slug) => [slug, await ctx.fetchText(`${SITE}models/${slug}/`)] as const));
      for (const [slug, html] of pages) { raw[`${slug}.html`] = html; models.push(parseCorpoModel(html, slug)); }
    }
    const { benchmarks, rows, skipped } = corpoResult(models, date);
    if (rows.filter((r) => r.benchmarkId === CORPO_ID).length < 10) throw new Error("Corpo-Bench: fewer than 10 cloud models");
    return { benchmarks, rows, raw, notes: [`${models.length} models on the board${skipped.length ? `; left out: ${skipped.join(", ")}` : ""}`] };
  },
};
export default source;
