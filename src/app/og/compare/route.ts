import { sidesFromQuery } from "@/components/compare/server";
import { loadSnapshot } from "@/data/load";
import { renderCompareCard } from "@/lib/og-compare";

export const dynamic = "force-dynamic";

/** Link-preview card for a comparison: /og/compare?a=<ref>&b=<ref>. A missing side is the default card. */
export async function GET(req: Request) {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const [snapshot, { a, b }] = await Promise.all([loadSnapshot(), sidesFromQuery(sp)]);
  if (!snapshot || !a || !b) return Response.redirect(new URL("/og", req.url), 302);
  return new Response(new Uint8Array(renderCompareCard(snapshot, a, b)), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300, s-maxage=3600" } });
}
