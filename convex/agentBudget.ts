import { mutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Hard daily spend cap for the mix assistant, enforced transactionally (Convex mutations are
 * serializable, so concurrent requests can't both slip under the cap). Only the Next.js server can
 * call these: every call carries AGENT_SERVER_SECRET, which is set in the Convex and Vercel
 * environments and never shipped to browsers.
 *   begin   — per-user daily request limit, and refuse once the day's cap is spent
 *   reserve — pre-authorize one model call at its worst-case cost, from a pool
 *   settle  — replace the reservation with the provider-reported cost
 * Two pools, each with its own daily cap: "base" (the default routes, GPT-6 Luna; AGENT_DAILY_USD_CAP, default $3) and "premium" (Claude
 * Sonnet 5.5 when it is turned on; AGENT_PREMIUM_DAILY_USD, default $6.50, about the $200 monthly API credit). The premium pool keeps
 * its own row per day ("<day>:premium"); a spent pool only moves the request to the next route.
 */
const pools = v.optional(v.union(v.literal("base"), v.literal("premium")));
const cap = (pool: "base" | "premium" = "base") => Number(pool === "premium" ? process.env.AGENT_PREMIUM_DAILY_USD ?? "6.5" : process.env.AGENT_DAILY_USD_CAP ?? "3");
const poolDay = (pool: "base" | "premium" | undefined) => pool === "premium" ? `${today()}:premium` : today();
const userLimit = () => Number(process.env.AGENT_USER_DAILY_REQUESTS ?? "40");
function check(secret: string) {
  const want = process.env.AGENT_SERVER_SECRET;
  if (!want || secret.length !== want.length) throw new Error("forbidden");
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ secret.charCodeAt(i);
  if (diff) throw new Error("forbidden");
}
const today = () => new Date().toISOString().slice(0, 10);

async function dayRow(ctx: MutationCtx, day: string) {
  const row = await ctx.db.query("agentSpend").withIndex("by_day", (q) => q.eq("day", day)).unique();
  if (row) return row;
  const id = await ctx.db.insert("agentSpend", { day, spentUsd: 0, reservedUsd: 0, calls: 0, requests: 0 });
  return (await ctx.db.get(id))!;
}

export const begin = mutation({
  args: { secret: v.string(), userId: v.string() },
  handler: async (ctx, { secret, userId }) => {
    check(secret);
    const day = today(), row = await dayRow(ctx, day);
    if (row.spentUsd + row.reservedUsd >= cap()) return { ok: false as const, reason: "daily-cap" };
    const user = await ctx.db.query("agentUsers").withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day)).unique();
    if ((user?.requests ?? 0) >= userLimit()) return { ok: false as const, reason: "user-limit" };
    if (user) await ctx.db.patch(user._id, { requests: user.requests + 1 }); else await ctx.db.insert("agentUsers", { userId, day, requests: 1, spentUsd: 0 });
    await ctx.db.patch(row._id, { requests: row.requests + 1 });
    return { ok: true as const };
  },
});

export const reserve = mutation({
  args: { secret: v.string(), estimateUsd: v.number(), pool: pools },
  handler: async (ctx, { secret, estimateUsd, pool }) => {
    check(secret);
    if (!(estimateUsd > 0) || estimateUsd > 1) throw new Error("bad estimate");
    const row = await dayRow(ctx, poolDay(pool));
    if (row.spentUsd + row.reservedUsd + estimateUsd > cap(pool)) return false;
    await ctx.db.patch(row._id, { reservedUsd: row.reservedUsd + estimateUsd, calls: row.calls + 1 });
    return true;
  },
});

export const settle = mutation({
  args: { secret: v.string(), userId: v.string(), estimateUsd: v.number(), actualUsd: v.number(), pool: pools },
  handler: async (ctx, { secret, userId, estimateUsd, actualUsd, pool }) => {
    check(secret);
    const day = today(), row = await dayRow(ctx, poolDay(pool));
    const actual = Math.max(0, Math.min(5, Number.isFinite(actualUsd) ? actualUsd : estimateUsd));
    await ctx.db.patch(row._id, { reservedUsd: Math.max(0, row.reservedUsd - estimateUsd), spentUsd: row.spentUsd + actual });
    const user = await ctx.db.query("agentUsers").withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day)).unique();
    if (user) await ctx.db.patch(user._id, { spentUsd: user.spentUsd + actual });
  },
});
