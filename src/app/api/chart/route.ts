import { chartFromLink } from "@/agent/link-chart";

export const runtime = "nodejs";

/**
 * Redraw an assistant chart from its link: the recipe (`c`) and the index it was asked under (`i`).
 * No model call and no sign-in, so a shared link works for anyone; every value comes from the data.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const r = await chartFromLink(q.get("i") ?? "", q.get("c") ?? "", q.get("date") ?? undefined);
  if ("error" in r) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ chart: r.chart, missing: r.missing }, { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } });
}
