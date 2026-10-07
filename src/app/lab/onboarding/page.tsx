import type { Metadata } from "next";
import { loadSnapshot } from "@/data/load";
import { onboardingSnapshot } from "@/data/client-snapshot";
import { defaultLineup } from "@/onboarding/defaults";
import { benchmarkQuality } from "@/onboarding/quality";
import { rankedCount } from "@/lib/ranked-count";
import { OnboardingLab } from "@/components/lab/OnboardingLab";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Onboarding lab", robots: { index: false, follow: false } };

export default async function Page() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10" role="alert">Benchmark data is unavailable.</main>;
  const lineup = defaultLineup(snapshot, 16);
  const quality = benchmarkQuality(snapshot);
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const observedModelIds = [...new Set(snapshot.observations.map((o) => variantModels.get(o.variantId)).filter((id): id is string => !!id))];
  const names = new Map(snapshot.models.map((m) => [m.id, m.name]));
  // A plausible page to have arrived from: the index top 5, lightly shuffled.
  const demoTop = [2, 0, 4, 1, 3].map((i) => names.get(lineup[i]) ?? lineup[i]);
  return <OnboardingLab snapshot={onboardingSnapshot(snapshot)} lineup={lineup} quality={quality} observedModelIds={observedModelIds} rankedCount={await rankedCount()} demoTop={demoTop} />;
}
