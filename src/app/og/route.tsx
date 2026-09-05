import { loadSnapshot } from "@/data/load";
import { decodeIndices } from "@/lib/url";
import { renderShareCard } from "@/lib/og";
import { defaultConfig } from "@/engine";

export const dynamic = "force-dynamic";

/** Share card for anonymous builds: /og?i=<encoded index>[&name=...] */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const snap = await loadSnapshot(u.searchParams.get("date") ?? undefined);
  if (!snap) return new Response("no data", { status: 503 });
  const list = decodeIndices(u.searchParams);
  const index = list[0] ?? defaultConfig(snap);
  return renderShareCard(snap, index, { name: u.searchParams.get("name") ?? "Someone’s priors" });
}
