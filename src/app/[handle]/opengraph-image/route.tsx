import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import { renderShareCard } from "@/lib/og";
import type { Profile } from "@/components/page/IndexPage";
import { presetOf } from "@/lib/page-presets";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const p = url ? ((await new ConvexHttpClient(url).query(api.profiles.byHandle, { handle })) as Profile | null) : null;
  const snap = await loadSnapshot();
  if (!p || !snap || !p.indices.length) return new Response("not found", { status: 404 });
  const { snapshot } = mergeImports(snap, p.imports ?? []);
  // Cards stay light; dark page schemes contribute their panel accent so the card still matches.
  const preset = presetOf(p.theme);
  const res = await renderShareCard(snapshot, p.indices[0], { name: p.displayName, handle: p.handle, avatarUrl: p.avatarUrl }, { design: p.theme?.cardDesign ?? "board", accent: preset.dark ? preset.panelAccent : p.theme?.accent ?? preset.accent, surface: preset.dark ? undefined : preset.bg });
  return new Response(res.body, { status: res.status, headers: { "content-type": "image/png", "cache-control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400" } });
}
