import type { Metadata } from "next";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, PAGE_VIEW, selectVariants, type IndexConfig } from "@/engine";

export const SITE_NAME = "Priors";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mypriors.com";
export const SITE_DESCRIPTION = "Build your own index of AI models. Pick the benchmarks that matter to you, weight them, and share the ranking.";
export const RANK_DESCRIPTION = "Rank a few AI models head to head and Priors finds the benchmark mix that agrees with you. About a minute, no sign-in.";
/** The default leaderboard on today's data: the picture for any link that has no card of its own. */
export const SITE_IMAGE = { url: "/og", width: 1200, height: 630, alt: "Today's AI model leaderboard on Priors" };

type Card = { url: string; width: number; height: number; alt: string };

/**
 * Everything a link preview needs for one route: title, description, address and a large image.
 * A route's `openGraph` replaces the layout's whole (Next merges metadata one level deep), so every
 * route goes through this instead of setting a bare title.
 */
export function pageMeta({ title, description = SITE_DESCRIPTION, path, share = path, image = SITE_IMAGE, type = "website" }: {
  title: string; description?: string; /** The canonical address. */ path: string; /** The address a share should open, when it carries more than the canonical one. */ share?: string; image?: Card; type?: "website" | "profile";
}): Metadata {
  return {
    title, description, alternates: { canonical: path },
    openGraph: { siteName: SITE_NAME, type, title, description, url: share, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [{ url: image.url, alt: image.alt }] },
  };
}

/** "Opus 5.5 76.3, GPT-6 Astra 73.5, GPT-6.1 Sol 72.8. 6 benchmarks: Humanity's Last Exam 29%, …" */
export function indexSummary(snapshot: Snapshot, index: IndexConfig): string | undefined {
  try {
    const r = computeIndex(snapshot, { ...index, variants: "all" }, PAGE_VIEW);
    const rows = selectVariants(r.ranked, chartVariantMode(index, "ranking"));
    if (!rows.length) return undefined;
    const leaders = rows.slice(0, 3).map((x) => `${x.model.name} ${x.score.toFixed(1)}`).join(", ");
    const benches = [...r.benchmarks].sort((a, b) => b.share - a.share);
    const mix = benches.slice(0, 3).map((b) => `${b.benchmark.shortName ?? b.benchmark.name} ${Math.round(b.share)}%`).join(", ");
    return `${leaders}. ${benches.length} benchmark${benches.length === 1 ? "" : "s"}: ${mix}${benches.length > 3 ? " and more" : ""}.`;
  } catch {
    return undefined;
  }
}

/** One line for a preview: sentences joined, cut at a word. */
export function previewText(parts: (string | undefined)[], max = 200): string {
  const text = parts.map((p) => p?.trim()).filter(Boolean).map((p) => /[.!?…]$/.test(p!) ? p : `${p}.`).join(" ");
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}
