import type { Metadata } from "next";
import { clientSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";
import { DEFAULT_PRIORS_MIX } from "@/onboarding/defaults";
import { ThemesLab } from "@/components/lab/ThemesLab";
import type { Profile } from "@/components/page/IndexPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Page themes lab", robots: { index: false, follow: false } };

export default async function Page() {
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main role="alert" className="p-10">Benchmark data is unavailable.</main>;
  const index = { ...DEFAULT_PRIORS_MIX, id: "lab", name: "My priors" };
  // A second index with no sections of its own, so every theme shows the index tabs and the copied layout.
  const second = { ...index, id: "lab-3d", name: "3D understanding", weights: { minebench: 10, "voxelbench-text": 10, threejseval: 10 }, required: [] };
  const profile: Profile = {
    _id: "lab", handle: "you", displayName: "Your Name", bio: "How I pick models: coding first, then whatever is cheapest at the frontier.",
    socials: [{ label: "X", url: "https://x.com/" }], indices: [index, second],
    sections: [{ id: "rank-lab", kind: "rankings", indexId: "lab" }, { id: "pareto-lab", kind: "pareto", indexId: "lab" }, { id: "gallery-lab", kind: "gallery", indexId: "lab" }],
    theme: { preset: "aa" },
  };
  return <ThemesLab profile={profile} snapshot={clientSnapshot(snapshot)} />;
}
