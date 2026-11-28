import type { Snapshot, SourceRun } from "@/data/types";
import type { IndexConfig } from "@/engine";

export const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
/** Scores older than this read as old: the scrape runs every 15 minutes. */
export const STALE_AFTER = 3 * HOUR;

/** The sources behind a mix, failed ones first, then the oldest scrape. */
export function sourcesFor(snapshot: Snapshot, config: IndexConfig): SourceRun[] {
  const ids = new Set<string>();
  for (const [id, w] of Object.entries(config.weights)) if (w > 0) { const s = snapshot.benchmarks.find((b) => b.id === id)?.sourceId; if (s) ids.add(s); }
  return snapshot.sources.filter((s) => ids.has(s.sourceId))
    .sort((a, b) => Number(b.status === "failed") - Number(a.status === "failed") || Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt));
}

/** The oldest scrape among a mix's sources (the snapshot's build time when none is known: an import has no source run). */
export function oldestFetch(snapshot: Snapshot, config: IndexConfig): number {
  const t = sourcesFor(snapshot, config).map((r) => Date.parse(r.fetchedAt)).filter(Number.isFinite);
  return t.length ? Math.min(...t) : Date.parse(snapshot.generatedAt);
}

/** "14 min ago", "3 h ago", "2 d ago", then the date (`at`) once it is a week old. `ms` is how long ago. */
export function ago(ms: number, at: number): string {
  const d = Math.max(0, ms);
  if (d < MIN) return "just now";
  if (d < HOUR) return `${Math.floor(d / MIN)} min ago`;
  if (d < DAY) return `${Math.floor(d / HOUR)} h ago`;
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} d ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
export const exactTime = (t: number) => new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const shortTime = (t: number) => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
