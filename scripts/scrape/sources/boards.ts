/**
 * Config-only boards (`../boards/configs.ts`). The build runs `sources`, one Source per config under its own id, so a broken page
 * fails, is reported and carries forward only its own board, and `--only <id>` (or `--only boards` for all) works as for any scraper.
 * The default export runs every config in one go for callers that want a single Source; it drops a failing board and keeps the rest.
 */
import type { Benchmark, RawRow, Source } from "../../../src/data/types";
import { BOARDS } from "../boards/configs";
import { boardSource } from "../boards/run";

export const sources: Source[] = BOARDS.map(boardSource);

const source: Source = {
  id: "boards", name: "Config-only boards", url: "https://mypriors.com",
  async scrape(ctx) {
    const got = await Promise.all(sources.map(async (s) => {
      try { return { id: s.id, r: await s.scrape(ctx) }; } catch (e) { return { id: s.id, error: e instanceof Error ? e.message : String(e) }; }
    }));
    const benchmarks: Benchmark[] = [], rows: RawRow[] = [], raw: Record<string, string> = {}, notes: string[] = [];
    for (const g of got) {
      if (!g.r) { notes.push(`${g.id} FAILED: ${g.error}`); continue; }
      benchmarks.push(...g.r.benchmarks); rows.push(...g.r.rows);
      for (const [k, v] of Object.entries(g.r.raw)) raw[`${g.id}-${k}`] = v;
      notes.push(`${g.id}: ${g.r.rows.length} rows`);
    }
    if (!rows.length) throw new Error(`every board failed: ${notes.join("; ")}`);
    return { benchmarks, rows, raw, notes };
  },
};
export default source;
