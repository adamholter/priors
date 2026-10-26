import type { BenchValue } from "@/engine";

/** One line saying what a peer estimate is built from: the range and the models that voted. */
export function peerNote(v: Pick<BenchValue, "estimateKind" | "estimateRange" | "donors">, nameOf: (variantId: string) => string, show = 3): string | undefined {
  if (v.estimateKind !== "peer" || !v.estimateRange || !v.donors?.length) return undefined;
  const [lo, hi] = v.estimateRange;
  const names: string[] = [];
  for (const d of v.donors) { const n = nameOf(d.variantId); if (!names.includes(n)) names.push(n); }
  const shown = names.slice(0, show);
  const rest = names.length - shown.length;
  return `Peer estimate, likely ${lo.toFixed(0)} to ${hi.toFixed(0)}, from ${shown.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
}
