import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { parseRef, type Ref } from "@/lib/compare-ref";
import { choiceFromIndex, choiceFromPage, choiceFromPreset, type Choice, type PageData, type Published } from "./choice";

type SP = Record<string, string | string[] | undefined>;
export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const client = () => { const url = process.env.NEXT_PUBLIC_CONVEX_URL; return url ? new ConvexHttpClient(url) : null; };

export async function loadPublishedPage(handle: string): Promise<PageData | null> {
  const p = await client()?.query(api.profiles.byHandle, { handle }).catch(() => null);
  return p ? { handle: p.handle, displayName: p.displayName, avatarUrl: p.avatarUrl, indices: p.indices as IndexConfig[], imports: p.imports as PageData["imports"] } : null;
}

export async function loadPublished(): Promise<Published[]> {
  const list = (await client()?.query(api.profiles.explore, {}).catch(() => [])) ?? [];
  return (list as { handle: string; displayName: string; avatarUrl?: string; indices: IndexConfig[] }[]).map((p) => ({ handle: p.handle, displayName: p.displayName, avatarUrl: p.avatarUrl, indexName: p.indices[0]?.name ?? "Rankings" }));
}

async function resolve(ref: Ref | undefined, snapshot: Snapshot | null): Promise<Choice | undefined> {
  if (!ref || ref.kind === "me") return undefined;
  if (ref.kind === "preset") return snapshot ? choiceFromPreset(snapshot, ref.id) : undefined;
  if (ref.kind === "index") return choiceFromIndex(ref.config);
  const p = await loadPublishedPage(ref.handle);
  return p ? choiceFromPage(p, ref.tab) : undefined;
}

/** Both sides as the address names them. `me` is the visitor's own, which only the browser knows: it is left for the client. */
export async function sidesFromQuery(sp: SP) {
  let ra = parseRef(one(sp.a), "cmp-a"), rb = parseRef(one(sp.b), "cmp-b");
  if (rb?.kind === "me" && ra?.kind !== "me") [ra, rb] = [rb, ra];
  if (ra?.kind === "me" && rb?.kind === "me") rb = undefined;
  const snapshot = ra?.kind === "preset" || rb?.kind === "preset" ? await loadSnapshot() : null;
  const [a, b] = await Promise.all([resolve(ra, snapshot), resolve(rb, snapshot)]);
  return { a, b, wantMine: ra?.kind === "me" || (!ra && !rb) || (!ra && !!rb) };
}
