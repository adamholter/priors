import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { indexConfig, profileTheme, section, storableIndex } from "./validators";
import { ConvexError, v } from "convex/values";
import type { IndexConfig } from "../src/engine";
import type { Id } from "./_generated/dataModel";

const HANDLE = /^[a-z0-9][a-z0-9-]{1,29}$/;
const RESERVED = new Set(["sign-in", "sign-up", "api", "skill", "import", "me", "og", "about", "admin", "priors", "u", "settings", "privacy", "terms", "builder", "claim", "models", "explore", "rank"]);

async function me(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const profile = await ctx.db.query("profiles").withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject)).unique();
  return { identity, profile };
}

/** True when another page shows this stored file. Two index lookups, however many pages exist. */
async function fileTaken(ctx: QueryCtx | MutationCtx, file: Id<"_storage">, self: Id<"profiles">) {
  const [avatar, banner] = await Promise.all([
    ctx.db.query("profiles").withIndex("by_avatar", (q) => q.eq("avatarStorageId", file)).take(2),
    ctx.db.query("profiles").withIndex("by_banner", (q) => q.eq("bannerStorageId", file)).take(2),
  ]);
  return [...avatar, ...banner].some((p) => p._id !== self);
}

/**
 * Deletes a stored image a page no longer shows, if it is that page's to delete. Every image stored
 * since uploads went through `/upload` (convex/http.ts) has an owner on record. One stored before
 * that has none, and counts as this page's unless another page shows it.
 */
async function dropFile(ctx: MutationCtx, file: Id<"_storage">, self: Id<"profiles">) {
  const record = await ctx.db.query("uploads").withIndex("by_storage", (q) => q.eq("storageId", file)).unique();
  if (record ? record.profileId !== self : await fileTaken(ctx, file, self)) return;
  if (await ctx.db.system.get(file)) await ctx.storage.delete(file);
  if (record) await ctx.db.delete(record._id);
}

/** Uploads one signed-in account may make in a day (UTC). Counted per account, so deleting a page and claiming again does not reset it. */
const MAX_UPLOADS_PER_DAY = 40;

export const mine = query({
  args: {},
  handler: async (ctx) => {
    const p = (await me(ctx))?.profile;
    if (!p) return null;
    // Resolve an uploaded photo so every surface shows the page's avatar, not the sign-in default.
    const avatarUrl = p.avatarStorageId ? await ctx.storage.getUrl(p.avatarStorageId) : p.avatarUrl;
    return { ...p, avatarUrl: avatarUrl ?? undefined };
  },
});

export const byHandle = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const p = await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", handle.toLowerCase())).unique();
    if (!p) return null;
    const imports = await ctx.db.query("imports").withIndex("by_profile", (q) => q.eq("profileId", p._id)).collect();
    const avatarUrl = p.avatarStorageId ? await ctx.storage.getUrl(p.avatarStorageId) : p.avatarUrl;
    const bannerUrl = p.bannerStorageId ? await ctx.storage.getUrl(p.bannerStorageId) : null;
    // Public: never the account id, the token hash or the storage ids (a storage id is what lets a page claim a file).
    const { agentTokenHash: _h, clerkId: _c, avatarStorageId: _a, bannerStorageId: _b, ...rest } = p; void _h; void _c; void _a; void _b;
    return { ...rest, avatarUrl: avatarUrl ?? undefined, bannerUrl: bannerUrl ?? undefined, imports: imports.map((i) => ({ benchmark: i.benchmark, rows: i.rows })) };
  },
});

/** Published pages for /explore, newest first: public fields only (never clerkId or token hash). */
export const explore = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("profiles").order("desc").take(300);
    const list = await Promise.all(rows.map(async (p) => ({
      handle: p.handle, displayName: p.displayName, bio: p.bio, updatedAt: p.updatedAt, createdAt: p._creationTime,
      avatarUrl: (p.avatarStorageId ? await ctx.storage.getUrl(p.avatarStorageId) : p.avatarUrl) ?? undefined,
      // The card ranks the main index; the page's other tabs are listed by name.
      indices: p.indices.slice(0, 1), others: p.indices.slice(1, 4).map((i) => i.name), more: Math.max(0, p.indices.length - 1),
    })));
    return list.filter((p) => p.indices.length).sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const handleAvailable = query({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const h = handle.toLowerCase();
    if (!HANDLE.test(h) || RESERVED.has(h)) return false;
    return !(await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", h)).unique());
  },
});

/** Create the profile on first claim, seeded with the anonymous indices the user built. */
export const claim = mutation({
  args: { handle: v.string(), displayName: v.string(), avatarUrl: v.optional(v.string()), indices: v.array(indexConfig) },
  handler: async (ctx, { handle, displayName, avatarUrl, indices }) => {
    const m = await me(ctx);
    if (!m) throw new Error("Sign in first");
    if (m.profile) throw new Error("Already claimed");
    const h = handle.toLowerCase();
    if (!HANDLE.test(h) || RESERVED.has(h)) throw new Error("Invalid handle");
    if (await ctx.db.query("profiles").withIndex("by_handle", (q) => q.eq("handle", h)).unique()) throw new Error("Handle taken");
    const list = Array.isArray(indices) && indices.length ? indices : [];
    const sections = list.flatMap((i: { id: string }) => [
      { id: `rank-${i.id}`, kind: "rankings" as const, indexId: i.id },
      { id: `pareto-${i.id}`, kind: "pareto" as const, indexId: i.id },
      { id: `gallery-${i.id}`, kind: "gallery" as const, indexId: i.id },
    ]);
    return ctx.db.insert("profiles", { clerkId: m.identity.subject, handle: h, displayName, avatarUrl, indices: list, sections, updatedAt: Date.now() });
  },
});

export const update = mutation({
  args: {
    patch: v.object({
      // Images arrive through the `/upload` endpoint (convex/http.ts), which checks the file. Here a banner can only be cleared (null).
      displayName: v.optional(v.string()), bio: v.optional(v.string()), avatarUrl: v.optional(v.string()), bannerStorageId: v.optional(v.null()),
      socials: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
      indices: v.optional(v.array(indexConfig)), sections: v.optional(v.array(section)),
      theme: v.optional(profileTheme),
    }),
  },
  handler: async (ctx, { patch }) => {
    const m = await me(ctx);
    if (!m?.profile) throw new Error("No profile");
    // A new avatar URL (e.g. "use my Google photo") replaces an uploaded one; null clears the banner.
    const { bannerStorageId, ...rest } = patch;
    const avatar = rest.avatarUrl ? undefined : m.profile.avatarStorageId, banner = bannerStorageId === null ? undefined : m.profile.bannerStorageId;
    await ctx.db.patch(m.profile._id, { ...rest, avatarStorageId: avatar, bannerStorageId: banner, updatedAt: Date.now() });
    // An image the page stopped showing is deleted, so nothing lingers at its old address.
    for (const old of new Set([m.profile.avatarStorageId, m.profile.bannerStorageId])) if (old && old !== avatar && old !== banner) await dropFile(ctx, old, m.profile._id);
  },
});

/**
 * Deletes the signed-in user's page for good: the profile, its imported benchmarks and its uploaded
 * images. The caller repeats the handle, so a stray call can never take a page down. The handle is
 * free to claim again afterwards.
 */
export const remove = mutation({
  args: { handle: v.string() },
  handler: async (ctx, { handle }) => {
    const m = await me(ctx);
    if (!m?.profile) throw new ConvexError("No page to delete");
    if (handle.trim().toLowerCase() !== m.profile.handle) throw new ConvexError("That is not your handle");
    for (const row of await ctx.db.query("imports").withIndex("by_profile", (q) => q.eq("profileId", m.profile!._id)).collect()) await ctx.db.delete(row._id);
    for (const file of new Set([m.profile.avatarStorageId, m.profile.bannerStorageId])) if (file) await dropFile(ctx, file, m.profile._id);
    // Anything else on record as this page's (there should be none: a replaced image is deleted when it is replaced).
    for (const r of await ctx.db.query("uploads").withIndex("by_profile", (q) => q.eq("profileId", m.profile!._id)).take(100)) {
      if (await ctx.db.system.get(r.storageId)) await ctx.storage.delete(r.storageId);
      await ctx.db.delete(r._id);
    }
    await ctx.db.delete(m.profile._id);
    return { handle: m.profile.handle };
  },
});

/**
 * Counts one upload against the signed-in account's day, before the upload's body is read, and says
 * whether it may go ahead. Internal: called by the `/upload` endpoint in convex/http.ts.
 */
export const reserveUpload = internalMutation({
  args: {},
  handler: async (ctx) => {
    const m = await me(ctx);
    if (!m?.profile) throw new ConvexError("Claim your page first");
    const day = new Date().toISOString().slice(0, 10), userId = m.identity.subject;
    const row = await ctx.db.query("uploadUsage").withIndex("by_user_day", (q) => q.eq("userId", userId).eq("day", day)).unique();
    if ((row?.count ?? 0) >= MAX_UPLOADS_PER_DAY) throw new ConvexError("Too many uploads today. Try again tomorrow.");
    if (row) await ctx.db.patch(row._id, { count: row.count + 1 }); else await ctx.db.insert("uploadUsage", { userId, day, count: 1 });
  },
});

/**
 * Puts an image the `/upload` endpoint has just checked and stored onto the signed-in user's page, and
 * records the page as its owner. Internal: a file id never comes from a browser. The image it replaces
 * is deleted, so a page holds at most one photo and one banner.
 */
export const setImage = internalMutation({
  args: { field: v.union(v.literal("avatar"), v.literal("banner")), storageId: v.id("_storage") },
  handler: async (ctx, { field, storageId }) => {
    const m = await me(ctx);
    if (!m?.profile) throw new ConvexError("Claim your page first");
    const key = field === "avatar" ? "avatarStorageId" : "bannerStorageId", old = m.profile[key];
    await ctx.db.insert("uploads", { storageId, profileId: m.profile._id });
    await ctx.db.patch(m.profile._id, { [key]: storageId, updatedAt: Date.now() });
    if (old && old !== m.profile[field === "avatar" ? "bannerStorageId" : "avatarStorageId"]) await dropFile(ctx, old, m.profile._id);
  },
});

export const addImport = mutation({
  args: { benchmark: v.any(), rows: v.any() },
  handler: async (ctx, { benchmark, rows }) => {
    const m = await me(ctx);
    if (!m?.profile) throw new Error("No profile");
    // replace an existing import of the same benchmark id
    const existing = await ctx.db.query("imports").withIndex("by_profile", (q) => q.eq("profileId", m.profile!._id)).collect();
    for (const e of existing) if (e.benchmark?.id === benchmark?.id) await ctx.db.delete(e._id);
    return ctx.db.insert("imports", { profileId: m.profile._id, benchmark, rows, createdAt: Date.now() });
  },
});

export const myImports = query({
  args: {},
  handler: async (ctx) => {
    const m = await me(ctx);
    if (!m?.profile) return [];
    return (await ctx.db.query("imports").withIndex("by_profile", (q) => q.eq("profileId", m.profile!._id)).collect()).map((i) => ({ benchmark: i.benchmark, rows: i.rows }));
  },
});

/* ---------------- agent access (skill) ---------------- */

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Owner mints a token; we store only its hash. Token is shown once. */
export const mintAgentToken = mutation({
  args: {},
  handler: async (ctx) => {
    const m = await me(ctx);
    if (!m?.profile) throw new Error("No profile");
    const bytes = new Uint8Array(24); crypto.getRandomValues(bytes);
    const token = "pri_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    await ctx.db.patch(m.profile._id, { agentTokenHash: await sha256(token), updatedAt: Date.now() });
    return token;
  },
});

/** Called from /api/agent with the bearer token. Applies an import or a page patch. */
export const agentApply = mutation({
  args: {
    token: v.string(),
    action: v.union(v.literal("import"), v.literal("page"), v.literal("indices"), v.literal("whoami")),
    payload: v.optional(v.any()),
  },
  handler: async (ctx, { token, action, payload }) => {
    const hash = await sha256(token);
    const p = await ctx.db.query("profiles").withIndex("by_token", (q) => q.eq("agentTokenHash", hash)).unique();
    if (!p) throw new Error("Invalid token");
    if (action === "whoami") return { handle: p.handle, displayName: p.displayName, indices: p.indices, sections: p.sections, socials: p.socials ?? [], bio: p.bio ?? "", theme: p.theme ?? {} };
    if (action === "import") {
      const { benchmark, rows } = payload ?? {};
      if (!benchmark?.id || !Array.isArray(rows)) throw new Error("payload must be { benchmark, rows[] }");
      const existing = await ctx.db.query("imports").withIndex("by_profile", (q) => q.eq("profileId", p._id)).collect();
      for (const e of existing) if (e.benchmark?.id === benchmark.id) await ctx.db.delete(e._id);
      await ctx.db.insert("imports", { profileId: p._id, benchmark, rows, createdAt: Date.now() });
      return { ok: true, benchmarkId: benchmark.id, rows: rows.length, url: `/${p.handle}` };
    }
    if (action === "indices") {
      if (!Array.isArray(payload)) throw new ConvexError("payload must be IndexConfig[]");
      // Agent payloads are untyped JSON: keep only stored fields, and report schema problems readably.
      try { await ctx.db.patch(p._id, { indices: payload.map((c: IndexConfig) => storableIndex(c)), updatedAt: Date.now() }); }
      catch (e) { throw new ConvexError(`Invalid index config: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`); }
      return { ok: true, url: `/${p.handle}` };
    }
    const patch: Record<string, unknown> = {};
    for (const k of ["displayName", "bio", "socials", "sections", "theme", "avatarUrl"] as const) if (payload?.[k] !== undefined) patch[k] = payload[k];
    await ctx.db.patch(p._id, { ...patch, updatedAt: Date.now() });
    return { ok: true, url: `/${p.handle}` };
  },
});
