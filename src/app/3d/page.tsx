import type { Metadata } from "next";
import { ThreeDApp } from "@/components/threed/ThreeDApp";
import { loadPublished, one, sidesFromQuery } from "@/components/compare/server";
import { pageMeta } from "@/lib/site-meta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta({ title: "3D view", description: "Any AI model ranking as one 3D chart: score against time per task and cost per task, with the best corner marked. Orbit, go isometric, change the axes.", path: "/3d" });

export default async function Page({ searchParams }: PageProps<"/3d">) {
  const sp = await searchParams;
  const [{ a, wantMine }, published] = await Promise.all([sidesFromQuery({ a: one(sp.a) }), loadPublished()]);
  return <ThreeDApp initial={a} wantMine={wantMine} axes={one(sp.ax)} published={published} />;
}
