import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import { benchmarkQuality } from "@/onboarding/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Why each benchmark has the quality score it has, by id: the onboarding's quality dialog. */
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid snapshot date." }, { status: 400 });
  const snapshot = await loadSnapshot(date);
  if (!snapshot) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  return NextResponse.json(Object.fromEntries(benchmarkQuality(snapshot).map((q) => [q.id, q.reason])), { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
