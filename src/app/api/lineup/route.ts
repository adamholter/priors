import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import type { Profile } from "@/components/page/IndexPage";
import { encodeIndex } from "@/lib/url";
import { defaultLineup, savedMix } from "@/onboarding/defaults";

export const runtime = "nodejs";

/** Migrate an older browser's saved fit into a current-snapshot lineup. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const raw = params.get("mix");
  const handle = params.get("handle");
  const snapshot = await loadSnapshot();
  if (!snapshot) return NextResponse.json({ error: "Snapshot unavailable." }, { status: 404 });
  let data = snapshot;
  let mix = savedMix(raw ?? undefined, data);
  if (!mix && handle && /^[a-z0-9][a-z0-9-]{1,29}$/i.test(handle) && process.env.NEXT_PUBLIC_CONVEX_URL) {
    const profile = await new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL)
      .query(api.profiles.byHandle, { handle }) as Profile | null;
    if (profile?.indices[0]) {
      data = mergeImports(snapshot, profile.imports ?? []).snapshot;
      mix = savedMix(encodeURIComponent(encodeIndex({ ...profile.indices[0], onlyModels: undefined, excludeModels: undefined })), data);
    }
  }
  if (!mix) return NextResponse.json({ error: "Saved mix unavailable." }, { status: 400 });
  return NextResponse.json({ lineup: defaultLineup(data, 16, mix), mix: encodeIndex(mix) }, { headers: { "Cache-Control": "private, no-store" } });
}
