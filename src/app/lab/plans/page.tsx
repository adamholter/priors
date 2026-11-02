import type { Metadata } from "next";
import { PlansLab } from "@/components/lab/PlansLab";
import type { PlanLayout } from "@/components/chart/PlanPicker";
import { clientSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";
import { defaultPriorsMix } from "@/onboarding/defaults";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Plan picker lab", robots: { index: false, follow: false } };
const LAYOUTS: Record<string, PlanLayout> = { a: "advanced", b: "pricing", c: "choices", d: "page" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { v } = await searchParams;
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main role="alert" className="p-10">Benchmark data is unavailable.</main>;
  return <PlansLab snapshot={clientSnapshot(snapshot)} indices={[{ ...defaultPriorsMix(snapshot), id: "lab", name: "My priors" }]} initial={typeof v === "string" ? LAYOUTS[v] : undefined} />;
}
