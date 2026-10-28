import type { Metadata } from "next";
import { IndexLab } from "@/components/lab/IndexLab";
import { clientSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";
import { defaultPriorsMix } from "@/onboarding/defaults";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Builder sharing lab", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
 const sp = await searchParams;
 const snapshot = await loadSnapshot(typeof sp.date === "string" ? sp.date : undefined);
 if (!snapshot) return <main role="alert" className="p-10">Benchmark data is unavailable.</main>;
 const indices = decodeIndices(sp.i == null ? [] : Array.isArray(sp.i) ? sp.i : [sp.i]);
 return <IndexLab snapshot={clientSnapshot(snapshot)} indices={indices.length ? indices : [{ ...defaultPriorsMix(snapshot), id: "lab", name: "My priors" }]} />;
}
