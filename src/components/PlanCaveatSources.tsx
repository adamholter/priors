import type { PlanCaveat } from "@/data/subscription";

/** Who a preliminary subsidy rests on, each linked to what they published. */
export function PlanCaveatSources({ caveat, className = "" }: { caveat?: PlanCaveat; className?: string }) {
  const sources = caveat?.sources;
  if (!sources?.length) return null;
  const link = (s: { by: string; url: string }) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-ink">{s.by}</a>;
  const used = sources.filter((s) => s.counted), other = sources.filter((s) => !s.counted), list = (items: typeof sources) => items.flatMap((s, i) => (i ? [", ", link(s)] : [link(s)]));
  return <span className={`cap ${className}`}>Data from {list(used)}{other.length > 0 && <>; not counted: {list(other)}</>}</span>;
}
