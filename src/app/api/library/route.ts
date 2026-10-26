import { NextResponse } from "next/server";
import { loadMixLibrary } from "@/data/load";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? undefined;
  const library = await loadMixLibrary(date);
  if (!library) return NextResponse.json({ error: "No mix library for this snapshot." }, { status: 404 });
  return NextResponse.json(library, { headers: { "Cache-Control": "no-store" } });
}
