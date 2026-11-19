import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Stars on benchmarks: a signed-in person's way to say a benchmark is worth watching. Counts are public and lift a benchmark in the
 * directory's recommended order (`src/lib/benchmark-recommended.ts`); who starred what is only ever returned to that person.
 */
const ID = /^[a-z0-9][a-z0-9._:-]{0,119}$/i;
/** Enough for anyone, and a ceiling on what one account can write. */
const MAX_PER_USER = 500;

/** More than the benchmarks there are: the most ids one read may ask about. */
const MAX_IDS = 1000;

/**
 * Star counts for the benchmarks asked about, by id; ones nobody starred are absent. The caller names the ids (the pages pass the
 * snapshot's), and each is one indexed lookup: Convex does not know which ids are real benchmarks, so an account can star a made-up
 * id, but such rows are never read, cannot crowd real ones out, and are bounded by `MAX_PER_USER` per account.
 */
export const counts = query({
  // Optional only so a page built before ids were required gets an empty answer, not an error.
  args: { ids: v.optional(v.array(v.string())) },
  handler: async (ctx, { ids }) => {
    const out: Record<string, number> = {};
    for (const id of [...new Set(ids ?? [])].slice(0, MAX_IDS)) {
      if (!ID.test(id)) continue;
      const row = await ctx.db.query("benchmarkStarCounts").withIndex("by_benchmark", (q) => q.eq("benchmarkId", id)).unique();
      if (row && row.count > 0) out[id] = row.count;
    }
    return out;
  },
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
