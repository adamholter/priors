import type { Metadata } from "next";
import { CompareLab } from "@/components/lab/CompareLab";
import { loadPublished, sidesFromQuery } from "@/components/compare/server";
import { clientSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare lab", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: PageProps<"/lab/compare">) {
  const sp = await searchParams;
  const snapshot = await loadSnapshot();
  if (!snapshot) return <main role="alert" className="p-10">Benchmark data is unavailable.</main>;
  const [{ a, b }, published] = await Promise.all([sidesFromQuery(sp), loadPublished()]);
  return <CompareLab snapshot={clientSnapshot(snapshot)} published={published} initialA={a} initialB={b} />;
}
