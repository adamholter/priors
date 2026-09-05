import type { Snapshot } from "@/data/types";

/** A single benchmark's leaderboard as the source publishes it, with lab colors. */
export function BenchmarkTable({ snapshot, benchmarkId, limit = 25 }: { snapshot: Snapshot; benchmarkId: string; limit?: number }) {
  const b = snapshot.benchmarks.find((x) => x.id === benchmarkId);
  if (!b) return <p className="cap">Unknown benchmark {benchmarkId}</p>;
  const models = new Map(snapshot.models.map((m) => [m.id, m]));
  const color = new Map(snapshot.labs.map((l) => [l.id, l.color]));
  const rows = snapshot.observations.filter((o) => o.benchmarkId === benchmarkId).sort((x, y) => (b.higherIsBetter ? y.value - x.value : x.value - y.value)).slice(0, limit);
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <div>
      <p className="text-[13px] text-ink-2 mb-3 max-w-[70ch]">{b.description} <a href={b.url} target="_blank" rel="noreferrer" className="text-indigo">Source</a></p>
      <div className="grid gap-[4px]">
        {rows.map((o, i) => {
          const [mid, effort] = o.variantId.split("@"); const m = models.get(mid);
          return (
            <div key={o.variantId} className="grid grid-cols-[28px_minmax(150px,220px)_1fr_64px_64px] items-center gap-2.5 h-[24px] text-[12.5px]">
              <span className="cap text-right">{i + 1}</span>
              <span className="truncate">{m?.name ?? mid}{effort !== "default" && <em className="not-italic cap ml-1.5">{effort}</em>}</span>
              <span className="h-[10px] rounded-[2px] bg-hair-2 overflow-hidden"><i className="block h-full rounded-[2px]" style={{ width: `${(Math.abs(o.value) / max) * 100}%`, background: color.get(m?.labId ?? "") ?? "#A3A39B" }} /></span>
              <span className="num text-right">{b.unit === "percent" ? `${o.value.toFixed(1)}%` : b.unit === "usd" ? `$${o.value.toFixed(2)}` : o.value.toFixed(b.unit === "elo" ? 0 : 1)}</span>
              <span className="num text-right text-grey">{o.costUsd != null ? `$${o.costUsd.toFixed(2)}` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
