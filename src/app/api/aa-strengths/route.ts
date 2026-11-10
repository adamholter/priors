import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import { aaStrengths } from "@/lib/aa-strengths";

const HEADERS = { "access-control-allow-origin": "*", "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" };

/** The evaluations in Artificial Analysis's Intelligence Index and each configuration's score on them. Public, read-only. */
export async function GET() {
  const s = await loadSnapshot();
  if (!s) return NextResponse.json({ error: "no snapshot" }, { status: 503 });
  return NextResponse.json(aaStrengths(s), { headers: HEADERS });
}
