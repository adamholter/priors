import { cookies } from "next/headers";
import { loadSnapshot } from "@/data/load";
import { Onboarding } from "@/onboarding/Onboarding";
import { PageTransition } from "@/components/PageTransition";
import { onboardingSnapshot } from "@/data/client-snapshot";
import { defaultLineup, PRIORS_MIX_COOKIE, savedMix } from "@/onboarding/defaults";
import { benchmarkQuality } from "@/onboarding/quality";
export const dynamic = "force-dynamic";
export const metadata = { title: "What are your priors?" };

/** The ranking onboarding. Always reachable here; `/` sends returning visitors to the builder instead. */
export default async function Rank() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
  const mix = savedMix((await cookies()).get(PRIORS_MIX_COOKIE)?.value, snapshot);
  const lineup = defaultLineup(snapshot, 16, mix ?? undefined);
  const quality = benchmarkQuality(snapshot);
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const observedModelIds = [...new Set(snapshot.observations.map((o) => variantModels.get(o.variantId)).filter((id): id is string => !!id))];
  return <PageTransition><Onboarding snapshot={onboardingSnapshot(snapshot)} lineup={lineup} quality={quality} observedModelIds={observedModelIds} hasSavedMix={!!mix} seeds={lineup} /></PageTransition>;
}
