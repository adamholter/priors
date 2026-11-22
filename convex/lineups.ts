import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

/** Record a completed lineup fit. Anonymous and best-effort — the UI never blocks on it. */
export const record = mutation({
  args: {
    focus: v.string(),
    lineup: v.array(v.string()),
    weights: v.any(),
    strictness: v.number(),
    fitScore: v.number(),
    exact: v.boolean(),
    snapshotDate: v.string(),
  },
  handler: async (ctx, args) => {
    const lineup = args.lineup.filter((id) => typeof id === "string" && id.length > 0);
    if (lineup.length < 2 || lineup.length > 40) throw new Error("Lineup must have 2–40 model ids.");
    return ctx.db.insert("lineups", {
      focus: args.focus,
      lineup,
      key: `${args.focus}|${lineup.join(",")}`,
      weights: args.weights,
      strictness: args.strictness,
      fitScore: args.fitScore,
      exact: args.exact,
      snapshotDate: args.snapshotDate,
      createdAt: Date.now(),
    });
  },
});

/** Most common lineups for a focus: counts plus a representative lineup per key. */
export const top = query({
  args: { focus: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { focus, limit }) => {
    const rows = await ctx.db.query("lineups").collect();
    const groups = new Map<string, { count: number; lineup: string[] }>();
    for (const row of rows) {
      if (row.focus !== focus) continue;
      const group = groups.get(row.key);
      if (group) group.count++;
      else groups.set(row.key, { count: 1, lineup: row.lineup });
    }
    return [...groups.entries()]
      .map(([key, g]) => ({ key, count: g.count, lineup: g.lineup }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit ?? 10);
  },
});

/** Finished rankings, capped at 1,000. The UI labels the ceiling as 1,000+. */
export const count = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => (await ctx.db.query("lineups").take(1000)).length,
});

/** Every finished ranking, oldest first, without the fitted weights: the votes behind PriorsBench (`src/lib/priorsbench.ts`). */
export const forBench = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("lineups").order("asc").paginate({ ...paginationOpts, numItems: Math.min(paginationOpts.numItems, 2000) });
    return { ...page, page: page.page.map((r) => ({ lineup: r.lineup, focus: r.focus, createdAt: r.createdAt })) };
  },
});
