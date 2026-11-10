import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import { planPrices } from "@/lib/plan-prices";

const HEADERS = { "access-control-allow-origin": "*", "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600" };

/** What a subscriber pays as a share of API price, per model, with each model's Artificial Analysis slugs. Public, read-only. */
export async function GET() {
  const s = await loadSnapshot();
  if (!s) return NextResponse.json({ error: "no snapshot" }, { status: 503 });
  return NextResponse.json(planPrices(s), { headers: HEADERS });
}
