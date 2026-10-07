import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/** Finished rankings so far, for social proof. 0 when Convex is unreachable (the UI hides it). */
export async function rankedCount(): Promise<number> {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return 0;
  try { return await new ConvexHttpClient(url).query(api.lineups.count, {}); } catch { return 0; }
}
