import { redirect } from "next/navigation";
import BuilderPage from "./builder/page";
import { framedSize, linkFrame } from "@/lib/og-chart";
import { DATA_DESCRIPTION, pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";
// The layout's title template skips pages in its own segment, so the home page spells the whole title out.
export const metadata = { ...pageMeta({ title: "AI model rankings, cost and speed", description: DATA_DESCRIPTION, path: "/", image: { url: "/og", ...framedSize(linkFrame(new URLSearchParams())), alt: "AI model rankings on Priors" } }), title: { absolute: "AI model rankings, cost and speed · priors" } };

/** Entry point: the data, on Artificial Analysis' index. Links carrying an index go to the builder's address. Ranking stays at /rank. */
export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  if (sp.i != null || sp.date != null || sp.design != null || sp.handle != null) redirect(`/builder?${query}`);
  return <BuilderPage params={Promise.resolve({})} searchParams={Promise.resolve(sp)} />;
}
