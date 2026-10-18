import { computeIndex, defaultConfig, PAGE_VIEW, type IndexConfig } from "../../engine";
import { defaultPriorsMix } from "../../onboarding/defaults";
import type { Snapshot } from "../../data/types";
import { mergeImports } from "../../lib/import";
import { placeModels, type Placed } from "../../lib/compare";
import { pageIndex, pageRef, type Ref } from "../../lib/compare-ref";
import { tabKey } from "../../lib/page-layout";

type Imports = Parameters<typeof mergeImports>[1];

/** A published page as /compare needs it: who, and every index (tab) it holds. */
export interface PageData { handle: string; displayName: string; avatarUrl?: string; indices: IndexConfig[]; imports?: Imports }
/** One row of the picker's list of published pages (Explore's data: the main index only). */
export interface Published { handle: string; displayName: string; avatarUrl?: string; indexName: string }

/** One side, fully resolved: the ranking to draw and who it belongs to. */
export interface Choice {
  ref: Ref;
  /** Heading on the side's card and in the picker. */
  title: string;
  /** How a sentence names the side ("you", or the person's name). */
  short: string;
  /** The index's name. */
  sub: string;
  handle?: string;
  avatarUrl?: string;
  config: IndexConfig;
  imports?: Imports;
  /** The page's other tabs, when it has several. */
  tabs?: { key: string; name: string }[];
  /** Where "Open page" goes. */
  href?: string;
  mine?: boolean;
}

export function choiceFromPage(page: PageData, tab?: string, mine = false): Choice | undefined {
  const config = pageIndex(page.indices, tab);
  if (!config) return undefined;
  return {
    ref: pageRef(page.handle, page.indices, config), title: mine ? "You" : page.displayName, short: mine ? "you" : page.displayName,
    sub: config.name, handle: page.handle, avatarUrl: page.avatarUrl, config, imports: page.imports,
    tabs: page.indices.length > 1 ? page.indices.map((i) => ({ key: i === page.indices[0] ? "" : tabKey(page.indices, i), name: i.name })) : undefined,
    href: `/${page.handle}${config === page.indices[0] ? "" : `?hi=${tabKey(page.indices, config)}`}`, mine,
  };
}

export function choiceFromIndex(config: IndexConfig, opts: { title?: string; short?: string; mine?: boolean; ref?: Ref } = {}): Choice {
  return { ref: opts.ref ?? { kind: "index", config }, title: opts.title ?? config.name, short: opts.short ?? config.name, sub: opts.mine ? config.name : "From a link", config, mine: opts.mine };
}

export interface Side { choice: Choice; result: ReturnType<typeof computeIndex>; placed: Placed[] }

/** Rank one side against the snapshot, with the side's own imported benchmarks and the page's default view. */
export function rankSide(snapshot: Snapshot, choice: Choice): Side {
  const snap = choice.imports?.length ? mergeImports(snapshot, choice.imports).snapshot : snapshot;
  const result = computeIndex(snap, { ...choice.config, variants: "all" }, PAGE_VIEW);
  return { choice, result, placed: placeModels(result.ranked, choice.config) };
}

/** A named starting point, built on today's data. */
export function choiceFromPreset(snapshot: Snapshot, id: string): Choice | undefined {
  const config = id === "aa" ? defaultPriorsMix(snapshot) : id === "general" ? defaultConfig(snapshot, "general", "General frontier") : undefined;
  return config && { ref: { kind: "preset", id }, title: config.name, short: config.name, sub: "Preset mix", config };
}
