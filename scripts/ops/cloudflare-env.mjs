import { parseEnv } from "node:util";

/** Import app settings only. Vercel's provider credentials never reach a Worker. */
export function cloudflareEnv(text) {
  return Object.fromEntries(Object.entries(parseEnv(text))
    .filter(([key]) => /^(NEXT_PUBLIC_|AGENT_SERVER_SECRET$|CLERK_SECRET_KEY$|OPENROUTER_API_KEY$|CONVEX_DEPLOY_KEY$)/.test(key))
    .map(([key, value]) => [key, value.trim()]));
}
