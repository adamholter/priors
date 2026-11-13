import type { ScrapeContext } from "../../src/data/types";
import { parseGoogleFree, parseOpenRouterFree, parseZenFree, type FreeTierEntry, type OpenRouterListing } from "../../src/data/free-tier";

const ZEN_MODELS = "https://opencode.ai/zen/v1/models";
const OPENROUTER_MODELS = "https://openrouter.ai/api/v1/models";
const GOOGLE_PRICING = "https://aistudio.google.com/docs/pricing";

/**
 * Models free today on OpenCode Zen, OpenRouter and the Gemini API (rate-limited ones are marked; see src/data/free-tier.ts). `build.ts` turns the ones the index ranks into
 * ratio 0 subscription rows (`applyFreeTiers`). A list that comes back empty or in a new shape throws,
 * so a changed format carries yesterday's free models forward instead of quietly pricing them again.
 */
export async function fetchFreeTiers(ctx: ScrapeContext): Promise<{ entries: FreeTierEntry[]; raw: Record<string, string> }> {
  const [zen, openrouter, google] = await Promise.all([
    ctx.fetchJson<{ data?: { id?: unknown }[] }>(ZEN_MODELS),
    ctx.fetchJson<{ data?: OpenRouterListing[] }>(OPENROUTER_MODELS),
    // Optional: a changed Google page drops only its entries, never the other lists.
    ctx.fetchText(GOOGLE_PRICING).then(parseGoogleFree).catch((e: unknown) => { ctx.log(`Gemini API pricing page not read: ${e instanceof Error ? e.message : String(e)}`); return [] as FreeTierEntry[]; }),
  ]);
  const ids = (zen.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
  if (ids.length < 10) throw new Error("OpenCode Zen: unexpected model list");
  if (!openrouter.data || openrouter.data.length < 50) throw new Error("OpenRouter: unexpected model list");
  const entries = [...parseZenFree(ids), ...parseOpenRouterFree(openrouter.data), ...google];
  if (!entries.length) throw new Error("no free models found on OpenCode Zen or OpenRouter");
  ctx.log(`${entries.length} free listings (${entries.filter((e) => e.provider === "opencode").length} OpenCode Zen, ${entries.filter((e) => e.provider === "openrouter").length} OpenRouter, ${google.length} Gemini API; rate-limited: OpenRouter and Gemini API)`);
  return { entries, raw: { "zen-models.json": JSON.stringify(ids), "free-listings.json": JSON.stringify(entries, null, 1) } };
}
