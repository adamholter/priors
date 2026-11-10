import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requestKind, requestStatus } from "./validators";
import { cleanRequest, clientKey, DAILY_CAP, LIMIT_MESSAGE, limitOf, tokenMatches } from "./requestRules";

/**
 * Requests for a benchmark or a feature, sent from `/request`. Anyone can send one; nobody but the holder of
 * `REQUESTS_TOKEN` (a Convex environment variable) can read them, so one visitor's request never reaches another.
 * `scripts/ops/pull-requests.mjs` reads them with that token.
 */
const cap = () => Number(process.env.REQUESTS_DAILY_CAP ?? DAILY_CAP);
const DAY_MS = 86_400_000;
const PAGE = 1000;

function guard(token: string) {
  if (!tokenMatches(token, process.env.REQUESTS_TOKEN)) throw new ConvexError("forbidden");
}

/** A request as its reader gets it: everything but the sender's cooldown key. */
const readable = (r: Doc<"requests">) => ({ id: r._id, kind: r.kind, text: r.text, url: r.url, contact: r.contact, handle: r.handle, createdAt: r.createdAt, status: r.status });

/**
 * Store one request. Expected refusals (bad input, the cooldown, the daily cap) come back as `{ ok: false }` with a
 * sentence for the form. `website` is the form's hidden trap field: a script that fills it is told it worked and
 * nothing is stored.
 */
export const submit = mutation({
  args: { kind: requestKind, text: v.string(), url: v.optional(v.string()), contact: v.optional(v.string()), client: v.optional(v.string()), website: v.optional(v.string()) },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), reason: v.union(v.literal("invalid"), v.literal("cooldown"), v.literal("full")), error: v.string() })),
  handler: async (ctx, { kind, text, url, contact, client, website }) => {
    if (website) return { ok: true as const };
    const cleaned = cleanRequest({ kind, text, url, contact });
    if (!cleaned.ok) return { ok: false as const, reason: "invalid" as const, error: cleaned.error };
    const identity = await ctx.auth.getUserIdentity();
    const profile = identity ? await ctx.db.query("profiles").withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject)).unique() : null;
    const key = clientKey(identity?.subject, client), now = Date.now();
    const last = await ctx.db.query("requests").withIndex("by_client", (q) => q.eq("client", key)).order("desc").first();
    const day = await ctx.db.query("requests").withIndex("by_created", (q) => q.gt("createdAt", now - DAY_MS)).take(cap());
    const limit = limitOf({ now, lastAt: last?.createdAt, dayCount: day.length, cap: cap() });
    if (limit) return { ok: false as const, reason: limit, error: LIMIT_MESSAGE[limit] };
    await ctx.db.insert("requests", { ...cleaned.value, handle: profile?.handle, client: key, createdAt: now, status: "new" });
    return { ok: true as const };
  },
});

/**
 * Requests newest first, for the holder of `REQUESTS_TOKEN` only: it throws when the variable is unset or the token is
 * wrong. `since` and `before` bound `createdAt` (both exclusive); at most 1,000 come back per call, so a reader pages
 * older with `before`.
 */
export const list = query({
  args: { token: v.string(), since: v.optional(v.number()), before: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, { token, since, before, limit }) => {
    guard(token);
    const n = Number.isFinite(limit) ? Math.max(1, Math.min(PAGE, Math.floor(limit!))) : PAGE;
    const rows = await ctx.db.query("requests").withIndex("by_created", (q) => { const from = q.gt("createdAt", since ?? -1); return before === undefined ? from : from.lt("createdAt", before); }).order("desc").take(n);
    return rows.map(readable);
  },
});

/** Mark a request new, seen or done. Same token as `list`. */
export const setStatus = mutation({
  args: { token: v.string(), id: v.id("requests"), status: requestStatus },
  returns: v.null(),
  handler: async (ctx, { token, id, status }) => {
    guard(token);
    if (!await ctx.db.get(id)) throw new ConvexError("No such request");
    await ctx.db.patch(id, { status });
    return null;
  },
});
