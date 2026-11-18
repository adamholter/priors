import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import type { Snapshot } from "@/data/types";
import { DATA_TAG_HEADER } from "@/lib/data-cache-tag";
import { presetConfig } from "@/lib/model-view";
import { rankStability, type RankStability } from "@/lib/rank-stability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = new WeakMap<Snapshot, Map<string, RankStability>>();

/** How much each model's rank moves when a standard ranking's weights are shaken. `?r=general|aa`, `?model=<id>` for one model. No page draws this. */
export async function GET(req: Request) {
  const snapshot = await loadSnapshot();
  if (!snapshot) return NextResponse.json({ error: "no snapshot" }, { status: 503 });
  const url = new URL(req.url), key = url.searchParams.get("r") === "aa" ? "preset:aa" : "preset:general", model = url.searchParams.get("model");
  const bySnapshot = cache.get(snapshot) ?? cache.set(snapshot, new Map()).get(snapshot)!;
  const all = bySnapshot.get(key) ?? bySnapshot.set(key, rankStability(snapshot, presetConfig(snapshot, key))).get(key)!;
  return NextResponse.json(model ? { ...all, models: all.models.filter((m) => m.id === model) } : all, { headers: { "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600", ...DATA_TAG_HEADER } });
}
