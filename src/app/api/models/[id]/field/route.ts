import { NextResponse } from "next/server";
import { defaultConfig } from "@/engine";
import { loadSnapshot } from "@/data/load";
import { otherField, presetConfig } from "@/lib/model-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The benchmarks outside a standard ranking that measured this model: the long list a model page opens on request. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await loadSnapshot();
  if (!snapshot?.models.some((m) => m.id === id)) return NextResponse.json({ error: "Model not found." }, { status: 404 });
  const r = new URL(req.url).searchParams.get("r");
  return NextResponse.json(otherField(snapshot, id, presetConfig(snapshot, r === "aa" ? "preset:aa" : "preset:general"), defaultConfig(snapshot)), { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
}
