/** Surge's live sudo L7 leaderboard. Scores come from the board, not the launch blog. */
import type { RawRow, Source } from "../../../src/data/types";

// Preserve the existing dashboard-import id so saved mixes keep working.
export const SUDO_L7_ID = "bg-sudo-l7";
export const SUDO_L7_PAGE = "https://surgehq.ai/benchmarks/sudo-l7";

function text(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&#(x[\da-f]+|\d+);/gi, (_, code: string) =>
    String.fromCodePoint(code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ").trim();
}

export function parseSudoL7(html: string): RawRow[] {
  // Only the primary board uses data-leaderboard-row. Related benchmark cards are excluded.
  const blocks = html.split(/<div\b[^>]*\bdata-leaderboard-row(?:\s|=|>)[^>]*>/i).slice(1);
  if (!blocks.length) throw new Error("sudo L7 page has no leaderboard rows");
  return blocks.map((block) => {
    const field = (name: string) => text(block.match(new RegExp(`class=["']${name}["'][^>]*>([\\s\\S]*?)<\\/div>`, "i"))?.[1] ?? "");
    const brand = field("head-rank-table-brand"), name = field("head-rank-table-name");
    const label = `${brand} ${name}`.trim();
    const score = text(block.match(/<[^>]*\bdata-score(?:\s|=|>)[^>]*>([^<]*)<\//i)?.[1] ?? "");
    const value = Number(score);
    const harness = name.match(/\[([^\]]+)\]\s*$/)?.[1];
    const effort = name.match(/\((?:Adaptive\/)?(none|minimal|low|medium|high|xhigh|max)(?:\s+reasoning)?\)/i)?.[1]?.toLowerCase();
    if (!brand || !name || !harness || !effort || !/^\d+(?:\.\d+)?$/.test(score) || value < 0 || value > 100) {
      throw new Error(`sudo L7 leaderboard schema changed: ${label || "missing model"}`);
    }
    return {
      benchmarkId: SUDO_L7_ID, modelLabel: `${brand} ${name.replace(/\s*\([^)]*\)\s*\[[^\]]+\]\s*$/, "")}`.trim(),
      effort, value, harness, sourceUrl: SUDO_L7_PAGE,
      // The static page's rank fields all read 1; do not pass them off as rankings.
      note: `Published configuration: ${label}`,
    };
  });
}

const source: Source = {
  id: "surge-sudo-l7", name: "Surge sudo L7", url: SUDO_L7_PAGE,
  async scrape(ctx) {
    const html = await ctx.fetchText(SUDO_L7_PAGE);
    const rows = parseSudoL7(html);
    return {
      benchmarks: [{
        id: SUDO_L7_ID, name: "sudo L7", sourceId: this.id, url: SUDO_L7_PAGE,
        description: "Surge AI's 60-task staff-level software engineering benchmark. Expert-authored rubrics assess correctness, architecture, production risk, verification and communication, using each model's published agent harness and reasoning setting.",
        unit: "percent" as const, higherIsBetter: true, category: "coding" as const,
        normalization: { kind: "linear" as const, min: 0, max: 100 }, eligibleForDefault: true, defaultWeight: 0,
      }],
      rows, raw: { "sudo-l7.html": html }, notes: [`${rows.length} live model results`],
    };
  },
};
export default source;
