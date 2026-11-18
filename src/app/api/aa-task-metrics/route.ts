import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import { aaTaskMetrics } from "@/lib/aa-task-metrics";
import { DATA_TAG_HEADER } from "@/lib/data-cache-tag";

const HEADERS = { "access-control-allow-origin": "*", "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600", ...DATA_TAG_HEADER };

/** Cost and time per task from Priors' other sources, by Artificial Analysis slug. Public, read-only. */
export async function GET() {
  const s = await loadSnapshot();
  if (!s) return NextResponse.json({ error: "no snapshot" }, { status: 503 });
  return NextResponse.json(aaTaskMetrics(s), { headers: HEADERS });
}
