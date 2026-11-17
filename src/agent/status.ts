import Anthropic from "@anthropic-ai/sdk";
import { agentRoutes } from "./agent";
import type { Keys, Provider } from "./providers";

/** Whether a key is accepted, by each provider's free model or key listing (HTTP status; 0 when unreachable). Never a paid call. */
const CHECKS: Record<Provider, (key: string) => Promise<number>> = {
  openai: (key) => fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${key}` } }).then((r) => r.status),
  openrouter: (key) => fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${key}` } }).then((r) => r.status),
  anthropic: (key) => new Anthropic({ apiKey: key, maxRetries: 0 }).models.list({ limit: 1 }).then(() => 200, (e: unknown) => (e instanceof Anthropic.APIError && typeof e.status === "number" ? e.status : 0)),
};

/**
 * The assistant's routes as this deployment sees them, and whether each provider accepts its key: provider names, models and status
 * codes only, never a key. A key accepted here can still be out of credit (OpenAI's account was, on November 17, 2026); the loop then
 * moves to the next route. Cached for ten minutes per instance, so the endpoint can't be used to hammer the providers.
 */
export async function assistantStatus(keys: Keys, env: Record<string, string | undefined>, checks = CHECKS) {
  const routes = agentRoutes(keys, env);
  const accepted = Object.fromEntries(await Promise.all((Object.keys(keys) as Provider[]).map(async (p) => [p, await checks[p](keys[p]!).catch(() => 0)] as const)));
  return { routes: routes.map((r) => ({ provider: r.provider, model: r.model, pool: r.pool })), keys: accepted, claude: env.AGENT_CLAUDE === "on" };
}
