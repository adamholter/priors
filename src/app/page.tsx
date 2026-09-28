import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadSnapshot } from "@/data/load";
import { Onboarding } from "@/onboarding/Onboarding";
import { PageTransition } from "@/components/PageTransition";
import { onboardingSnapshot } from "@/data/client-snapshot";
import { defaultLineup, PRIORS_MIX_COOKIE, savedMix } from "@/onboarding/defaults";
import { benchmarkQuality } from "@/onboarding/quality";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  if (sp.i != null || sp.date != null || sp.design != null || sp.handle != null) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
    }
    redirect(`/builder?${query}`);
  }
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
  const mix = savedMix((await cookies()).get(PRIORS_MIX_COOKIE)?.value, snapshot);
  const lineup = mix ? defaultLineup(snapshot, 14, mix) : defaultLineup(snapshot);
  const quality = benchmarkQuality(snapshot);
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  const observedModelIds = [...new Set(snapshot.observations.map((o) => variantModels.get(o.variantId)).filter((id): id is string => !!id))];
  return <PageTransition><Onboarding snapshot={onboardingSnapshot(snapshot)} lineup={lineup} quality={quality} observedModelIds={observedModelIds} hasSavedMix={!!mix} /></PageTransition>;
}
