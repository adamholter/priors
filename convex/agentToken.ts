import type { QueryCtx } from "./_generated/server";

/** SHA-256 hex of an agent token. Only the hash is stored; the token is shown to its owner once. */
export async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The page an agent token belongs to, or null. Every agent write starts here. */
export async function profileByToken(ctx: QueryCtx, token: string) {
  if (!token) return null;
  const hash = await sha256(token);
  return ctx.db.query("profiles").withIndex("by_token", (q) => q.eq("agentTokenHash", hash)).unique();
}
