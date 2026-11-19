import type { PlanCaveat } from "@/data/subscription";

/** Who a preliminary subsidy rests on, linked to what they published when public. */
export function PlanCaveatSources({ caveat, className = "" }: { caveat?: PlanCaveat; className?: string }) {
  const sources = caveat?.sources;
  if (!sources?.length) return null;
  const item = (s: { by: string; url?: string }) => s.url ? <a key={`${s.by}:${s.url}`} href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-ink">{s.by}</a> : <span key={s.by}>{s.by}</span>;
  const used = sources.filter((s) => s.counted), other = sources.filter((s) => !s.counted), list = (items: typeof sources) => items.flatMap((s, i) => (i ? [", ", item(s)] : [item(s)]));
  return <span className={`cap ${className}`}>Data from {list(used)}{other.length > 0 && <>; not counted: {list(other)}</>}</span>;
}
