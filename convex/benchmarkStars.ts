import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Stars on benchmarks: a signed-in person's way to say a benchmark is worth watching. Counts are public and lift a benchmark in the
 * directory's recommended order (`src/lib/benchmark-recommended.ts`); who starred what is only ever returned to that person.
 */
const ID = /^[a-z0-9][a-z0-9._:-]{0,119}$/i;
/** Enough for anyone, and a ceiling on what one account can write. */
const MAX_PER_USER = 500;

/** Far more than the benchmarks there are: a ceiling on what one read returns, whatever ids people invent. */
const MAX_COUNTS = 2000;

/**
 * Every benchmark's star count, by id. Benchmarks nobody starred are absent. Convex does not know which ids are real benchmarks
 * (the list lives in the snapshot), so an account can star a made-up id: the pages only read counts for benchmarks they list, a
 * counter is deleted when it reaches zero, and one account holds at most `MAX_PER_USER` stars.
 */
export const counts = query({
  args: {},
  handler: async (ctx) => Object.fromEntries((await ctx.db.query("benchmarkStarCounts").take(MAX_COUNTS)).filter((r) => r.count > 0).map((r) => [r.benchmarkId, r.count])),
});

/** The benchmarks the signed-in person starred. Empty when signed out. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return (await ctx.db.query("benchmarkStars").withIndex("by_user", (q) => q.eq("userId", identity.subject)).collect()).map((r) => r.benchmarkId);
  },
});

/** Star or unstar a benchmark. Answers the new state and the new count. */
export const toggle = mutation({
  args: { benchmarkId: v.string() },
  handler: async (ctx, { benchmarkId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Sign in to star a benchmark.");
    if (!ID.test(benchmarkId)) throw new Error("Unknown benchmark.");
    const existing = await ctx.db.query("benchmarkStars").withIndex("by_user", (q) => q.eq("userId", identity.subject).eq("benchmarkId", benchmarkId)).unique();
    const counter = await ctx.db.query("benchmarkStarCounts").withIndex("by_benchmark", (q) => q.eq("benchmarkId", benchmarkId)).unique();
    if (existing) {
      await ctx.db.delete(existing._id);
      const count = Math.max(0, (counter?.count ?? 1) - 1);
      if (counter) { if (count > 0) await ctx.db.patch(counter._id, { count }); else await ctx.db.delete(counter._id); }
      return { starred: false, count };
    }
    const held = await ctx.db.query("benchmarkStars").withIndex("by_user", (q) => q.eq("userId", identity.subject)).take(MAX_PER_USER + 1);
    if (held.length > MAX_PER_USER) throw new Error("That is a lot of stars. Remove one first.");
    await ctx.db.insert("benchmarkStars", { userId: identity.subject, benchmarkId, createdAt: Date.now() });
    const count = (counter?.count ?? 0) + 1;
    if (counter) await ctx.db.patch(counter._id, { count }); else await ctx.db.insert("benchmarkStarCounts", { benchmarkId, count });
    return { starred: true, count };
  },
});
