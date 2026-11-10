import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { requestKind, requestStatus } from "./validators";
import { cleanRequest, clientKey, DAILY_CAP, fileLimitOf, FILES_DAILY_CAP, isAccountKey, LIMIT_MESSAGE, limitOf, MAX_FILE_BYTES, MAX_FILES, tokenMatches } from "./requestRules";

/**
 * Bug reports and requests for a feature, a benchmark or anything else, sent from `/request`, with the files attached to
 * them. Anyone can send one; nobody but the holder of
 * `REQUESTS_TOKEN` (a Convex environment variable) can read them, so one visitor's request never reaches another.
 * `scripts/ops/pull-requests.mjs` reads them with that token.
 */
const cap = () => Number(process.env.REQUESTS_DAILY_CAP ?? DAILY_CAP);
const DAY_MS = 86_400_000;
const PAGE = 1000;

function guard(token: string) {
  if (!tokenMatches(token, process.env.REQUESTS_TOKEN)) throw new ConvexError("forbidden");
}

/** A request as its reader gets it: everything but the sender's cooldown key, with a link to each attached file. */
async function readable(ctx: QueryCtx, r: Doc<"requests">) {
  const files = await ctx.db.query("requestFiles").withIndex("by_request", (q) => q.eq("requestId", r._id)).collect();
  const linked = await Promise.all(files.flatMap((f) => (f.storageId ? [f as typeof f & { storageId: Id<"_storage"> }] : [])).map(async (f) => ({ id: f._id, name: f.name, type: f.type, size: f.size, url: await ctx.storage.getUrl(f.storageId) })));
  return { id: r._id, kind: r.kind, text: r.text, url: r.url, contact: r.contact, context: r.context, handle: r.handle, createdAt: r.createdAt, status: r.status, files: linked };
}

/**
 * Store one request. Expected refusals (bad input, the cooldown, the daily cap) come back as `{ ok: false }` with a
 * sentence for the form. Senders without an account share three quarters of the daily cap, so a script that rotates
 * its browser id cannot shut signed-in people out. `website` is the form's hidden trap field: a script that fills it is told it worked and
 * nothing is stored.
 */
export const submit = mutation({
  args: { kind: requestKind, text: v.string(), url: v.optional(v.string()), contact: v.optional(v.string()), context: v.optional(v.string()), files: v.optional(v.array(v.id("requestFiles"))), client: v.optional(v.string()), website: v.optional(v.string()) },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), reason: v.union(v.literal("invalid"), v.literal("cooldown"), v.literal("full")), error: v.string() })),
  handler: async (ctx, { kind, text, url, contact, context, files, client, website }) => {
    if (website) return { ok: true as const };
    const cleaned = cleanRequest({ kind, text, url, contact, context });
    if (!cleaned.ok) return { ok: false as const, reason: "invalid" as const, error: cleaned.error };
    // Files were uploaded a moment ago through /request-file, which gave the form their ids. One that is gone, old or already sent is refused.
    const fileIds = [...new Set(files ?? [])];
    if (fileIds.length > MAX_FILES) return { ok: false as const, reason: "invalid" as const, error: `Attach at most ${MAX_FILES} files.` };
    for (const id of fileIds) {
      const f = await ctx.db.get(id);
      if (!f || !f.storageId || f.requestId || Date.now() - f.createdAt > DAY_MS) return { ok: false as const, reason: "invalid" as const, error: "An attached file is no longer there. Attach it again." };
    }
    const identity = await ctx.auth.getUserIdentity();
    const profile = identity ? await ctx.db.query("profiles").withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject)).unique() : null;
    const key = clientKey(identity?.subject, client), now = Date.now();
    const last = await ctx.db.query("requests").withIndex("by_client", (q) => q.eq("client", key)).order("desc").first();
    const day = await ctx.db.query("requests").withIndex("by_created", (q) => q.gt("createdAt", now - DAY_MS)).take(cap());
    const limit = limitOf({ now, lastAt: last?.createdAt, dayCount: day.length, anonCount: day.filter((r) => !isAccountKey(r.client)).length, signedIn: !!identity, cap: cap() });
    if (limit) return { ok: false as const, reason: limit, error: LIMIT_MESSAGE[limit] };
    const requestId = await ctx.db.insert("requests", { ...cleaned.value, handle: profile?.handle, client: key, createdAt: now, status: "new" });
    for (const id of fileIds) await ctx.db.patch(id, { requestId });
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
    return Promise.all(rows.map((r) => readable(ctx, r)));
  },
});

/**
 * Before a file is read: is this sender, and everyone together, still under the upload limits? When so it writes the file's
 * row at once, in the same transaction as the count, so two uploads arriving together cannot both take the last place.
 * Throws a sentence for the form when not. `size` is what the request says it is sending, or the most a file may be.
 */
export const reserveFile = internalMutation({
  args: { client: v.string(), size: v.number() },
  returns: v.id("requestFiles"),
  handler: async (ctx, { client, size }): Promise<Id<"requestFiles">> => {
    const now = Date.now(), cap = Number(process.env.REQUEST_FILES_DAILY_CAP ?? FILES_DAILY_CAP);
    const reserved = Math.max(1, Math.min(MAX_FILE_BYTES, Math.floor(size) || MAX_FILE_BYTES));
    const mine = await ctx.db.query("requestFiles").withIndex("by_client", (q) => q.eq("client", client).gt("createdAt", now - 3_600_000)).take(200);
    const day = await ctx.db.query("requestFiles").withIndex("by_created", (q) => q.gt("createdAt", now - DAY_MS)).take(cap + 1);
    const limit = fileLimitOf({ hourCount: mine.length, dayCount: day.length, dayBytes: day.reduce((n, f) => n + f.size, 0), size: reserved, cap });
    if (limit) throw new ConvexError(limit);
    return ctx.db.insert("requestFiles", { name: "", type: "", size: reserved, client, createdAt: now });
  },
});

/** The file behind a reservation has been stored: record what it is. Its id is what the form sends with the report. */
export const fillFile = internalMutation({
  args: { id: v.id("requestFiles"), storageId: v.id("_storage"), name: v.string(), type: v.string(), size: v.number() },
  returns: v.null(),
  handler: async (ctx, { id, ...file }) => { await ctx.db.patch(id, file); return null; },
});

/** The upload behind a reservation did not happen (too big, not a kind of file we take, a dropped connection): give the place back. */
export const dropFile = internalMutation({
  args: { id: v.id("requestFiles") },
  returns: v.null(),
  handler: async (ctx, { id }) => { const f = await ctx.db.get(id); if (f && !f.storageId && !f.requestId) await ctx.db.delete(id); return null; },
});

/** Deletes files that were uploaded but never sent with a report, a day on, and reservations whose upload never finished, an hour on (crons.ts runs it). */
export const sweepFiles = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const loose = await ctx.db.query("requestFiles").withIndex("by_request", (q) => q.eq("requestId", undefined)).take(300);
    let gone = 0;
    for (const f of loose) {
      if (Date.now() - f.createdAt < (f.storageId ? DAY_MS : 3_600_000)) continue;
      if (f.storageId && await ctx.db.system.get(f.storageId)) await ctx.storage.delete(f.storageId);
      await ctx.db.delete(f._id);
      gone++;
    }
    return gone;
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
