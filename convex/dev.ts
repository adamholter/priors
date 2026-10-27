import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Dev-only: seed or remove a demo profile without Clerk. `npx convex run dev:seed '{"handle":"demo"}'` */
export const seed = internalMutation({
  args: { handle: v.string(), indices: v.any(), tokenHash: v.optional(v.string()) },
  handler: async (ctx, { handle, indices, tokenHash }) => {
    const existing = await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", handle)).unique();
    if (existing) await ctx.db.delete(existing._id);
    return ctx.db.insert("profiles", {
      clerkId: `dev-${handle}`, agentTokenHash: tokenHash, handle, displayName: "Demo Person", bio: "A demo page seeded for QA.",
      socials: [{ label: "X", url: "https://x.com" }], indices,
      sections: [
        { id: "r1", kind: "rankings", indexId: indices[0].id },
        { id: "p1", kind: "pareto", indexId: indices[0].id },
        { id: "t1", kind: "text", title: "Why these weights", body: "Agentic coding first; knowledge second." },
        { id: "s1", kind: "speed", indexId: indices[0].id },
        { id: "b1", kind: "benchmark", benchmarkId: "frontierswe-v2" },
      ],
      updatedAt: Date.now(),
    });
  },
});

export const unseed = internalMutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const p = await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", handle)).unique();
    if (p) await ctx.db.delete(p._id);
  },
});
