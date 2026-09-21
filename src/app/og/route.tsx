import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { mergeImports } from "@/lib/import";
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
  const handle = u.searchParams.get("handle");
  const profile = handle && process.env.NEXT_PUBLIC_CONVEX_URL ? await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL).query(api.profiles.byHandle, { handle }) : null;
  const snapshot = profile ? mergeImports(snap, profile.imports).snapshot : snap;
  const list = decodeIndices(u.searchParams);
  const index = list[0] ?? defaultConfig(snapshot);
  const res = await renderShareCard(snapshot, index, profile ? { name: profile.displayName, handle: profile.handle, avatarUrl: profile.avatarUrl } : { name: u.searchParams.get("name") ?? "" }, { design: u.searchParams.get("design") ?? undefined });
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "image/png", "cache-control": "public, max-age=600, s-maxage=86400, stale-while-revalidate=86400" } });
}
