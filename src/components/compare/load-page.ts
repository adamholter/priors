import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { IndexConfig } from "@/engine";
import type { PageData } from "./choice";

/** A published page by handle, read in the browser from the public query (no sign-in needed). */
export async function loadPage(handle: string): Promise<PageData | null> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  const p = await new ConvexHttpClient(url).query(api.profiles.byHandle, { handle });
  return p ? { handle: p.handle, displayName: p.displayName, avatarUrl: p.avatarUrl, indices: p.indices as IndexConfig[], imports: p.imports as PageData["imports"] } : null;
}
