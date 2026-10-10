import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { onboardingSnapshot } from "@/data/client-snapshot";
import { defaultLineup } from "@/onboarding/defaults";
import { benchmarkQuality } from "@/onboarding/quality";
import { SearchLab } from "@/components/lab/SearchLab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search animation lab", robots: { index: false, follow: false } };

export default async function Page() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10" role="alert">Benchmark data is unavailable.</main>;
  // A few swaps away from the default, so the search has real work to show.
  const lineup = defaultLineup(snapshot, 16);
  for (const [a, b] of [[1, 3], [5, 8], [10, 12]]) if (lineup.length > b) [lineup[a], lineup[b]] = [lineup[b], lineup[a]];
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const observedModelIds = [...new Set(snapshot.observations.map((o) => variantModels.get(o.variantId)).filter((id): id is string => !!id))];
  return <SearchLab snapshot={onboardingSnapshot(snapshot)} lineup={lineup} quality={benchmarkQuality(snapshot)} observedModelIds={observedModelIds} />;
}
