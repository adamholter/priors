import type { Metadata } from "next";
import { CompareApp } from "@/components/compare/CompareApp";
import { loadPublished, one, sidesFromQuery } from "@/components/compare/server";
import { loadSnapshot } from "@/data/load";
import { compareLead } from "@/lib/og-compare";
import { compareUrl } from "@/lib/compare-ref";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: PageProps<"/compare">): Promise<Metadata> {
  const { a, b } = await sidesFromQuery(await searchParams);
  if (!a || !b) return pageMeta({ title: "Compare rankings", description: "Put two AI model rankings side by side: yours, a friend's, or any shared link.", path: "/compare" });
  const snapshot = await loadSnapshot();
  let description = `${a.title} and ${b.title}: two AI model rankings, side by side.`;
  if (snapshot) try {
    const { shared, n, rho, gap } = compareLead(snapshot, a, b);
    description = [`${shared} of the top ${n} are on both lists${rho != null ? `, order agreement ${rho.toFixed(2)}` : ""}.`, gap ? `Biggest split: ${gap.name}, #${gap.a!.rank} vs #${gap.b!.rank}.` : ""].filter(Boolean).join(" ");
  } catch { /* keep the plain description */ }
  const query = compareUrl(a.ref, b.ref).slice("/compare".length);
  return pageMeta({ title: `${a.title} vs ${b.title}: compare rankings`, description, path: "/compare", share: `/compare${query}`, image: { url: `/og/compare${query}`, width: 1200, height: 630, alt: `${a.title} and ${b.title} rankings side by side` } });
}

export default async function Page({ searchParams }: PageProps<"/compare">) {
  const sp = await searchParams;
  const [{ a, b, wantMine }, published] = await Promise.all([sidesFromQuery(sp), loadPublished()]);
  const n = Number(one(sp.n));
  return <CompareApp initialA={a} initialB={b} wantMine={wantMine} top={[5, 10, 20].includes(n) ? n : 10} same={one(sp.same) === "1"} published={published} />;
}
