import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { mergeImports } from "@/lib/import";
import type { Profile } from "@/components/page/IndexPage";
import { encodeIndex, encodeIndices, prettyQuery } from "@/lib/url";
import { cookies } from "next/headers";
import { loadMixLibrary, loadSnapshot } from "@/data/load";
import { rankingEvidence } from "@/onboarding/evidence";
import { Onboarding } from "@/onboarding/Onboarding";
import { PageTransition } from "@/components/PageTransition";
import { onboardingSnapshot } from "@/data/client-snapshot";
import { defaultLineup, defaultPriorsMix, PRIORS_MIX_COOKIE, savedMix } from "@/onboarding/defaults";
import { benchmarkQuality } from "@/onboarding/quality";
import { rankedCount } from "@/lib/ranked-count";
import { pageMeta, RANK_DESCRIPTION } from "@/lib/site-meta";
export const dynamic = "force-dynamic";
export const metadata = pageMeta({ title: "What are your priors?", description: RANK_DESCRIPTION, path: "/rank" });

/** The ranking onboarding. Always reachable here; `/` sends returning visitors to the builder instead. */
export default async function Rank() {
  let snapshot = await loadSnapshot();
  if (!snapshot) return <main className="p-10">No benchmark snapshot available.</main>;
  let mix = savedMix((await cookies()).get(PRIORS_MIX_COOKIE)?.value, snapshot);
  // A returning account may have no saved browser cookie on this device.
  if (!mix && process.env.NEXT_PUBLIC_CONVEX_URL && process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const { userId, getToken } = await auth();
      const token = userId ? await getToken({ template: "convex" }) : null;
      if (token) {
        const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
        client.setAuth(token);
        const profile = await client.query(api.profiles.mine, {}) as Profile | null;
        if (profile?.indices[0]) {
          snapshot = mergeImports(snapshot, profile.imports ?? []).snapshot;
          mix = savedMix(encodeURIComponent(encodeIndex(profile.indices[0])), snapshot);
        }
      }
    } catch { /* Cookie or AA default remains available when account lookup fails. */ }
  }
  const lineup = defaultLineup(snapshot, 16, mix ?? undefined);
  const quality = benchmarkQuality(snapshot);
  const [count, library] = await Promise.all([rankedCount(), loadMixLibrary(snapshot.date)]);
  const evidence = rankingEvidence(snapshot, library, lineup);
  const variantModels = new Map(snapshot.variants.map((v) => [v.id, v.modelId]));
  // Skipping the ranking opens the builder on Artificial Analysis' composite, the first-time default.
  const skipHref = `/builder?${prettyQuery(encodeIndices([defaultPriorsMix(snapshot)]))}`;
  const observedModelIds = [...new Set(snapshot.observations.map((o) => variantModels.get(o.variantId)).filter((id): id is string => !!id))];
  return <PageTransition><Onboarding snapshot={onboardingSnapshot(snapshot)} lineup={lineup} quality={quality} observedModelIds={observedModelIds} hasSavedMix={!!mix} seeds={lineup} rankedCount={count} evidence={evidence} skipHref={skipHref} /></PageTransition>;
}
