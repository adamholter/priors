import { Builder } from "@/components/Builder";
import { listSnapshotDates, loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const date = typeof sp.date === "string" ? sp.date : undefined;
  const [snapshot, dates] = await Promise.all([loadSnapshot(date), listSnapshotDates()]);
  if (!snapshot) return <main className="p-10"><h1 className="text-3xl">priors</h1><p className="mt-3 text-ink-2">No snapshot yet. Run <code className="mono">npm run scrape</code>.</p></main>;
  const i = sp.i == null ? [] : Array.isArray(sp.i) ? sp.i : [sp.i];
  return <Builder snapshot={snapshot} dates={dates} initialIndices={decodeIndices(i)} />;
}
