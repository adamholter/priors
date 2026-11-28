import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { profileByToken } from "./agentToken";
import { BENCHMARK_ID, checkBlocks } from "./benchmarkPageRules";

/**
 * Benchmark pages their creators edit. Adam verifies a creator himself (he reaches out, gets their Priors handle) and grants it with
 * `npx convex run --prod benchmarkPages:grant '{"benchmarkId":"…","handle":"…"}'` (or `npm run creators -- grant …`, which checks the
 * benchmark id first). Grants have no public write path. A creator's own agent then edits the page with the page's agent token through
 * the tool API (`src/mcp/tools.ts`), the same token that edits their profile page.
 */

/** A creator as visitors see them: never the account id or token hash. */
async function creatorCard(ctx: QueryCtx, p: Doc<"profiles">) {
  const avatarUrl = p.avatarStorageId ? await ctx.storage.getUrl(p.avatarStorageId) : p.avatarUrl;
  return { handle: p.handle, displayName: p.displayName, avatarUrl: avatarUrl ?? undefined };
}

async function creatorsOf(ctx: QueryCtx, benchmarkId: string) {
  const grants = await ctx.db.query("benchmarkCreators").withIndex("by_benchmark", (q) => q.eq("benchmarkId", benchmarkId)).collect();
  const pages = await Promise.all(grants.map((g) => ctx.db.get(g.profileId)));
  return pages.filter((p): p is Doc<"profiles"> => !!p);
}

async function isCreator(ctx: QueryCtx, benchmarkId: string, profileId: Id<"profiles">) {
  const grants = await ctx.db.query("benchmarkCreators").withIndex("by_profile", (q) => q.eq("profileId", profileId)).collect();
  return grants.some((g) => g.benchmarkId === benchmarkId);
}

const pageOf = (ctx: QueryCtx, benchmarkId: string) => ctx.db.query("benchmarkPages").withIndex("by_benchmark", (q) => q.eq("benchmarkId", benchmarkId)).unique();

/** What visitors see: the verified creators and the visible blocks. Null when the benchmark has neither. */
export const byBenchmark = query({
  args: { benchmarkId: v.string() },
  handler: async (ctx, { benchmarkId }) => {
    if (!BENCHMARK_ID.test(benchmarkId)) return null;
    const [creators, page] = await Promise.all([creatorsOf(ctx, benchmarkId), pageOf(ctx, benchmarkId)]);
    const blocks = (page?.blocks ?? []).filter((b) => !b.hidden);
    if (!creators.length && !blocks.length) return null;
    return { creators: await Promise.all(creators.map((p) => creatorCard(ctx, p))), blocks, updatedAt: page?.updatedAt ?? null };
  },
});

/** For a signed-in creator of this benchmark: every block, hidden ones too. Null for anyone else. */
export const forEditor = query({
  args: { benchmarkId: v.string() },
  handler: async (ctx, { benchmarkId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || !BENCHMARK_ID.test(benchmarkId)) return null;
    const me = await ctx.db.query("profiles").withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject)).unique();
    if (!me || !(await isCreator(ctx, benchmarkId, me._id))) return null;
    const page = await pageOf(ctx, benchmarkId);
    return { handle: me.handle, blocks: page?.blocks ?? [], updatedAt: page?.updatedAt ?? null };
  },
});

/**
 * The agent API for creators, called by the tool API with the page's agent token.
 *   mine: the benchmarks this page is a verified creator of, with their blocks (hidden ones too)
 *   get:  one benchmark's blocks, hidden ones too
 *   set:  replace one benchmark's blocks (the tools build upsert and remove on top of this)
 */
export const agentApply = mutation({
  args: { token: v.string(), action: v.union(v.literal("mine"), v.literal("get"), v.literal("set")), benchmarkId: v.optional(v.string()), blocks: v.optional(v.any()) },
  handler: async (ctx, { token, action, benchmarkId, blocks }) => {
    const me = await profileByToken(ctx, token);
    if (!me) throw new Error("Invalid token");
    if (action === "mine") {
      const grants = await ctx.db.query("benchmarkCreators").withIndex("by_profile", (q) => q.eq("profileId", me._id)).collect();
      const out = await Promise.all(grants.map(async (g) => ({ benchmarkId: g.benchmarkId, blocks: (await pageOf(ctx, g.benchmarkId))?.blocks ?? [] })));
      return { handle: me.handle, benchmarks: out };
    }
    if (!benchmarkId || !BENCHMARK_ID.test(benchmarkId)) throw new ConvexError("benchmarkId is required.");
    if (!(await isCreator(ctx, benchmarkId, me._id))) {
      throw new ConvexError(`@${me.handle} is not a verified creator of "${benchmarkId}". Only verified creators can edit a benchmark's page; Adam verifies creators himself (mypriors.com/request).`);
    }
    const page = await pageOf(ctx, benchmarkId);
    if (action === "get") return { benchmarkId, blocks: page?.blocks ?? [], updatedAt: page?.updatedAt ?? null };
    const checked = checkBlocks(blocks);
    if (!checked.ok) throw new ConvexError(checked.error);
    const row = { blocks: checked.blocks, updatedAt: Date.now(), updatedBy: me._id };
    if (page) await ctx.db.patch(page._id, row); else await ctx.db.insert("benchmarkPages", { benchmarkId, ...row });
    return { ok: true, benchmarkId, blocks: checked.blocks.map((b) => `${b.id}:${b.kind}${b.hidden ? " (hidden)" : ""}`) };
  },
});

/* ---------------- verification: Adam only (internal functions run with the deploy key) ---------------- */

const byHandle = async (ctx: QueryCtx, handle: string) => {
  const p = await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", handle.trim().replace(/^@/, "").toLowerCase())).unique();
  if (!p) throw new ConvexError(`No Priors page has the handle "${handle}". They claim one at mypriors.com/claim first.`);
  return p;
};

/** Makes a page a verified creator of a benchmark. Idempotent. */
export const grant = internalMutation({
  args: { benchmarkId: v.string(), handle: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { benchmarkId, handle, note }) => {
    if (!BENCHMARK_ID.test(benchmarkId)) throw new ConvexError(`"${benchmarkId}" is not a benchmark id.`);
    const p = await byHandle(ctx, handle);
    if (await isCreator(ctx, benchmarkId, p._id)) return { ok: true, already: true, benchmarkId, handle: p.handle };
    await ctx.db.insert("benchmarkCreators", { benchmarkId, profileId: p._id, grantedAt: Date.now(), ...(note ? { note } : {}) });
    return { ok: true, benchmarkId, handle: p.handle };
  },
});

/** Takes a creator's access away. Their blocks stay on the page until someone clears them (`clearPage`). */
export const revoke = internalMutation({
  args: { benchmarkId: v.string(), handle: v.string() },
  handler: async (ctx, { benchmarkId, handle }) => {
    const p = await byHandle(ctx, handle);
    const rows = (await ctx.db.query("benchmarkCreators").withIndex("by_profile", (q) => q.eq("profileId", p._id)).collect()).filter((g) => g.benchmarkId === benchmarkId);
    for (const g of rows) await ctx.db.delete(g._id);
    return { ok: true, removed: rows.length, benchmarkId, handle: p.handle };
  },
});

/** Removes everything creators added to a benchmark's page. */
export const clearPage = internalMutation({
  args: { benchmarkId: v.string() },
  handler: async (ctx, { benchmarkId }) => {
    const page = await pageOf(ctx, benchmarkId);
    if (page) await ctx.db.delete(page._id);
    return { ok: true, cleared: !!page, benchmarkId };
  },
});

/** Every grant, or one benchmark's: who, since when, and how many blocks the page has. */
export const list = internalQuery({
  args: { benchmarkId: v.optional(v.string()) },
  handler: async (ctx, { benchmarkId }) => {
    const grants = benchmarkId
      ? await ctx.db.query("benchmarkCreators").withIndex("by_benchmark", (q) => q.eq("benchmarkId", benchmarkId)).collect()
      : await ctx.db.query("benchmarkCreators").collect();
    return Promise.all(grants.map(async (g) => ({
      benchmarkId: g.benchmarkId, handle: (await ctx.db.get(g.profileId))?.handle ?? "(deleted page)", grantedAt: new Date(g.grantedAt).toISOString(), note: g.note,
      blocks: (await pageOf(ctx, g.benchmarkId))?.blocks.length ?? 0,
    })));
  },
});
