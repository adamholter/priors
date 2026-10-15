import { loadSnapshot } from "@/data/load";
import { renderModelCard } from "@/lib/og-model";

export const dynamic = "force-dynamic";

/** The model page's share card: score, rank, best placements and its strengths radar. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await loadSnapshot();
  const png = snapshot ? renderModelCard(snapshot, id) : null;
  if (!png) return new Response("not found", { status: 404 });
  return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
}
