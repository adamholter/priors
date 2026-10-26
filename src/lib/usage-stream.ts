import type { Snapshot } from "@/data/types";

/** One model's turns per day in T3 Code (from the Slopalytics usage feed), over the feed's window. */
export interface UsageModel { id: string; name: string; labId?: string; total: number; daily: number[] }
export interface UsageData { days: string[]; models: UsageModel[]; /** Turns per day across every model, catch-all buckets included. */ totals: number[]; window?: string }

/** Daily usage per model, from the `t3-usage-share` observations. Null when the snapshot has no daily series. */
export function usageData(snapshot: Snapshot): UsageData | null {
  const variantModel = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const models = new Map(snapshot.models.map((m) => [m.id, m]));
  const byModel = new Map<string, UsageModel>();
  let start: string | undefined, totals: number[] | undefined, window: string | undefined;
  for (const o of snapshot.observations) {
    if (o.benchmarkId !== "t3-usage-share") continue;
    const d = o.details as { start?: string; daily?: number[]; dayTotals?: number[]; window?: string } | undefined;
    if (!d?.daily?.length || !d.dayTotals?.length || !d.start) continue;
    start ??= d.start; totals ??= d.dayTotals; window ??= d.window;
    const id = variantModel.get(o.variantId) ?? o.variantId.split("@")[0], model = models.get(id);
    const mine = byModel.get(id) ?? byModel.set(id, { id, name: model?.name ?? id, labId: model?.labId, total: 0, daily: d.dayTotals.map(() => 0) }).get(id)!;
    d.daily.forEach((n, i) => { if (i < mine.daily.length && n > 0) { mine.daily[i] += n; mine.total += n; } });
  }
  if (!start || !totals || !byModel.size) return null;
  const days = totals.map((_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));
  return { days, totals, window, models: [...byModel.values()].sort((a, b) => b.total - a.total) };
}

export interface UsageSeries { id: string; name: string; labId?: string; /** Share of that day's turns, percent. */ share: number[]; /** Turns that day. */ turns: number[] }
export interface UsageRow { id: string; name: string; labId?: string; perDay: number; share: number; /** Change in share, percentage points, first days to last days of the window. */ change: number }

/** The biggest `top` models by turns, then everything else as one "Other" series; rows for the table. */
export function usageStack(data: UsageData, top = 9): { series: UsageSeries[]; rows: UsageRow[] } {
  const shown = data.models.slice(0, top);
  const pct = (n: number, i: number) => (data.totals[i] > 0 ? (n / data.totals[i]) * 100 : 0);
  const series: UsageSeries[] = shown.map((m) => ({ id: m.id, name: m.name, labId: m.labId, turns: m.daily, share: m.daily.map(pct) }));
  const rest = data.totals.map((t, i) => Math.max(0, t - shown.reduce((s, m) => s + m.daily[i], 0)));
  if (rest.some((n) => n > 0)) series.push({ id: "other", name: "Other", turns: rest, share: rest.map(pct) });
  const sum = (a: number[]) => a.reduce((s, n) => s + n, 0), all = sum(data.totals) || 1;
  // Days with traffic only; the edges are averaged over three days so one quiet day does not set the change.
  const live = data.totals.map((t, i) => (t > 0 ? i : -1)).filter((i) => i >= 0);
  const edge = (s: UsageSeries, idx: number[]) => (idx.length ? sum(idx.map((i) => s.share[i])) / idx.length : 0);
  const rows = series.map((s): UsageRow => ({ id: s.id, name: s.name, labId: s.labId, perDay: sum(s.turns) / data.days.length, share: (sum(s.turns) / all) * 100, change: edge(s, live.slice(-3)) - edge(s, live.slice(0, 3)) }));
  return { series, rows };
}
