/**
 * A board config (see `configs.ts`) turned into a Benchmark and RawRows, and into a Source of its own, so the build
 * runs, reports, carries forward and `--only`s each board by its id exactly as it does a hand-written scraper.
 */
import type { Benchmark, BenchmarkCategory, BenchmarkUnit, RawRow, ScrapeContext, Source } from "../../../src/data/types";
import { readAriaLabel, readJson, readNextData, readTable, type AriaOptions, type BoardRow, type NextDataOptions, type SelectOptions, type TableOptions } from "./readers";

interface BoardBase {
  /** Benchmark id. Never change it once published: saved mixes and links use it. */
  id: string;
  name: string;
  shortName?: string;
  /** The public page, shown as the benchmark's link. Also what is fetched unless `fetch` is set. */
  url: string;
  /** Where the data lives when it is not the public page (a JSON endpoint, or a hub page that hosts several boards). */
  fetch?: string;
  /** Render with headless Chromium first, for pages that build the board in the browser. */
  browser?: boolean;
  /** Source id in the snapshot and the scrape log; default the benchmark id. */
  sourceId?: string;
  unit: BenchmarkUnit;
  higherIsBetter: boolean;
  category: BenchmarkCategory;
  categories?: BenchmarkCategory[];
  /** The source's own words; the catalog entry (`src/data/catalog/`) is what readers see. */
  description: string;
  /** Fewer parsed rows than this fails the board, so a changed page keeps the last scores instead of a stub. */
  minRows: number;
  normalization?: Benchmark["normalization"];
  defaultWeight?: number;
  eligibleForDefault?: boolean;
  /** Multiply value and interval (a 0-1 fraction into percent: 100). */
  scale?: number;
  /** Labels to drop (human baselines, agent products), tested against the page's label. */
  skip?: RegExp;
  /** Exact page label to the label to emit ("Beam" → "Beam 1.0"). Applied before `labelPrefix`. */
  labelMap?: Record<string, string>;
  /** Add a prefix to labels matching `when` (all when absent), unless they already start with it: Claude models written without the family. */
  labelPrefix?: { prefix: string; when?: RegExp };
  /** Note on every row. */
  note?: string;
}

export type BoardConfig = BoardBase & (
  | ({ reader: "ariaLabel" } & AriaOptions)
  | ({ reader: "nextData" } & NextDataOptions)
  | ({ reader: "json" } & SelectOptions)
  | ({ reader: "table" } & TableOptions)
);
export type ReaderName = BoardConfig["reader"];

/** Run a config's reader over fetched text. */
export function readBoard(c: Pick<BoardConfig, "reader"> & Record<string, unknown>, body: string): BoardRow[] {
  const o = c as never;
  switch (c.reader) {
    case "ariaLabel": return readAriaLabel(body, o as AriaOptions);
    case "nextData": return readNextData(body, o as NextDataOptions);
    case "json": return readJson(body, o as SelectOptions);
    case "table": return readTable(body, o as TableOptions);
    default: throw new Error(`unknown reader ${String(c.reader)}`);
  }
}

/** Label fixes and filtering a config asks for, shared with the dry-run CLI. */
export function fixLabel(c: Pick<BoardBase, "labelMap" | "labelPrefix">, label: string): string {
  let out = c.labelMap?.[label] ?? label;
  const p = c.labelPrefix;
  if (p && (!p.when || p.when.test(out)) && !out.toLowerCase().startsWith(p.prefix.trim().toLowerCase())) out = `${p.prefix}${out}`;
  return out;
}

export function boardRows(c: BoardConfig, body: string): RawRow[] {
  // Rows link the page the numbers were read from; a JSON endpoint is no page for a reader, so those link the public one.
  const k = c.scale ?? 1, sourceUrl = c.reader === "json" ? c.url : c.fetch ?? c.url;
  return readBoard(c as never, body).filter((r) => !c.skip?.test(r.modelLabel)).map((r) => ({
    benchmarkId: c.id, modelLabel: fixLabel(c, r.modelLabel), value: r.value * k, sourceUrl,
    ...(r.effort ? { effort: r.effort } : {}),
    ...(r.ci ? { ci: (k === 1 ? r.ci : r.ci.map((x) => x * k)) as [number, number] } : {}),
    ...(r.costUsd !== undefined ? { costUsd: r.costUsd } : {}),
    ...(r.details ? { details: r.details } : {}),
    ...(c.note ? { note: c.note } : {}),
  }));
}

export function boardBenchmark(c: BoardConfig): Benchmark {
  return {
    id: c.id, name: c.name, ...(c.shortName ? { shortName: c.shortName } : {}), sourceId: c.sourceId ?? c.id, url: c.url,
    description: c.description, unit: c.unit, higherIsBetter: c.higherIsBetter, category: c.category,
    ...(c.categories ? { categories: c.categories } : {}), ...(c.normalization ? { normalization: c.normalization } : {}),
    eligibleForDefault: c.eligibleForDefault ?? false, defaultWeight: c.defaultWeight ?? 0,
  };
}

export async function fetchBoard(ctx: ScrapeContext, c: Pick<BoardBase, "url" | "fetch" | "browser">): Promise<string> {
  const url = c.fetch ?? c.url;
  return c.browser ? ctx.withPage(url, (page) => page.content()) : ctx.fetchText(url);
}

/** Parse one board; throws when it parses fewer than `minRows`, so only this board fails. */
export function parseBoard(c: BoardConfig, body: string): { benchmark: Benchmark; rows: RawRow[] } {
  const rows = boardRows(c, body);
  if (rows.length < c.minRows) throw new Error(`${c.id}: parsed only ${rows.length} rows (min ${c.minRows})`);
  return { benchmark: boardBenchmark(c), rows };
}

export function boardSource(c: BoardConfig): Source {
  return {
    id: c.sourceId ?? c.id, name: c.name, url: c.url,
    async scrape(ctx) {
      const body = await fetchBoard(ctx, c);
      const { benchmark, rows } = parseBoard(c, body);
      return { benchmarks: [benchmark], rows, raw: { [c.reader === "json" ? "board.json" : "page.html"]: body }, notes: [`${c.reader}: ${rows.length} rows`] };
    },
  };
}
