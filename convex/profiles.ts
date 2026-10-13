import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { indexConfig, profileTheme, section, storableIndex } from "./validators";
import { ConvexError, v } from "convex/values";
import type { IndexConfig } from "../src/engine";
import type { Doc, Id } from "./_generated/dataModel";

const HANDLE = /^[a-z0-9][a-z0-9-]{1,29}$/;
const RESERVED = new Set(["sign-in", "sign-up", "api", "skill", "import", "me", "og", "about", "admin", "priors", "u", "settings", "privacy", "terms", "builder", "claim", "models", "explore", "rank"]);

async function me(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const profile = await ctx.db.query("profiles").withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject)).unique();
  return { identity, profile };
}

/** True when another page (any page, with no `self`) already shows this stored file. Two index lookups, however many pages exist. */
async function fileTaken(ctx: QueryCtx | MutationCtx, file: Id<"_storage">, self?: Id<"profiles">) {
  const [avatar, banner] = await Promise.all([
    ctx.db.query("profiles").withIndex("by_avatar", (q) => q.eq("avatarStorageId", file)).take(2),
    ctx.db.query("profiles").withIndex("by_banner", (q) => q.eq("bannerStorageId", file)).take(2),
  ]);
  return [...avatar, ...banner].some((p) => p._id !== self);
}

const FRESH_UPLOAD_MS = 15 * 60_000;
/**
 * The image types a page may show: an exact list, raster only. Storage serves a file back with the
 * type its uploader declared, so that type is compared whole, with no parsing of our own that could
 * read it differently from a browser, and image/svg+xml (a document that can carry script) is out.
 */
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
/** Upload links one page may ask for in a day. A link lets a file into storage before anything can check it, so the links are what gets rationed. */
const MAX_UPLOADS_PER_DAY = 40;
const BAD_IMAGE = "Use a PNG, JPEG, WebP, GIF or AVIF image";

/** What a file really is, from its first bytes. The declared type is only a claim; this is the check that the bytes are a picture. */
function sniffImage(b: Uint8Array): string | undefined {
  const at = (from: number, text: string) => [...text].every((c, i) => b[from + i] === c.charCodeAt(0));
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "image/gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(4, "ftyp") && (at(8, "avif") || at(8, "avis"))) return "image/avif";
  return undefined;
}

/**
 * Decides whether a page may show a stored image, and throws when it may not. A storage id arrives
 * from the client with no owner attached, so ownership is written down the first time a page attaches
 * a file and enforced from then on: a recorded file only ever goes back onto the page that uploaded
 * it. A file with no record must be one this page already shows (attached before records existed) or
 * an image uploaded in the last few minutes that no page shows, which is what a real upload looks
 * like. Everything here comes from the file's metadata, so it runs before any of the file is read.
 * Returns true when the file still needs its ownership record.
 */
async function vetFile(ctx: QueryCtx | MutationCtx, file: Id<"_storage">, self: Doc<"profiles">): Promise<boolean> {
  const record = await ctx.db.query("uploads").withIndex("by_storage", (q) => q.eq("storageId", file)).unique();
  if (record) { if (record.profileId !== self._id) throw new ConvexError("That image belongs to another page"); return false; }
  if (await fileTaken(ctx, file, self._id)) throw new ConvexError("That image belongs to another page");
  if (file !== self.avatarStorageId && file !== self.bannerStorageId) {
    const meta = await ctx.db.system.get(file);
    if (!meta || Date.now() - meta._creationTime > FRESH_UPLOAD_MS) throw new ConvexError("Upload the image again");
    if (meta.size > MAX_IMAGE_BYTES) throw new ConvexError("That image is over 8 MB");
    if (!IMAGE_TYPES.has(meta.contentType ?? "")) throw new ConvexError(BAD_IMAGE);
  }
  return true;
}

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
    const { agentTokenHash: _h, clerkId: _c, avatarStorageId: _a, bannerStorageId: _b, uploadDay: _d, uploadCount: _n, ...rest } = p; void _h; void _c; void _a; void _b; void _d; void _n;
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
      // Images are attached through attachImage, which checks the file. Here a banner can only be cleared (null).
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
    await ctx.db.patch(m.profile._id, { ...rest, ...(rest.avatarUrl ? { avatarStorageId: undefined } : {}), ...(bannerStorageId !== undefined ? { bannerStorageId: bannerStorageId ?? undefined } : {}), updatedAt: Date.now() });
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
    // Every image this page uploaded, including ones it has since replaced.
    const records = await ctx.db.query("uploads").withIndex("by_profile", (q) => q.eq("profileId", m.profile!._id)).take(500);
    const files = new Set(records.map((r) => r.storageId));
    // Images attached before uploads were recorded: its own unless another page's record or page says otherwise.
    for (const file of [m.profile.avatarStorageId, m.profile.bannerStorageId]) {
      if (!file || files.has(file)) continue;
      const record = await ctx.db.query("uploads").withIndex("by_storage", (q) => q.eq("storageId", file)).unique();
      if (!record && !(await fileTaken(ctx, file, m.profile._id))) files.add(file);
    }
    for (const file of files) if (await ctx.db.system.get(file)) await ctx.storage.delete(file);
    for (const r of records) await ctx.db.delete(r._id);
    await ctx.db.delete(m.profile._id);
    return { handle: m.profile.handle };
  },
});

/**
 * Puts an uploaded image on the signed-in user's page as its photo or banner. This is the only way a
 * stored file reaches a page. Cheapest checks first: owner, size and declared type from metadata
 * (vetUpload), and only then the file's first bytes, to confirm it really is a raster image. A file
 * that fails is removed from storage again (discardUpload).
 */
export const attachImage = action({
  args: { field: v.union(v.literal("avatar"), v.literal("banner")), storageId: v.id("_storage") },
  handler: async (ctx, { field, storageId }) => {
    if (!(await ctx.auth.getUserIdentity())) throw new ConvexError("Sign in first");
    try {
      await ctx.runQuery(internal.profiles.vetUpload, { storageId });
      const blob = await ctx.storage.get(storageId);
      if (!blob || !sniffImage(new Uint8Array(await blob.slice(0, 16).arrayBuffer()))) throw new ConvexError(BAD_IMAGE);
    } catch (e) {
      await ctx.runMutation(internal.profiles.discardUpload, { storageId });
      throw new ConvexError(e instanceof ConvexError && typeof e.data === "string" ? e.data : "Couldn’t use that image");
    }
    await ctx.runMutation(internal.profiles.setImage, { field, storageId });
  },
});

/** The metadata half of attachImage's checks. */
export const vetUpload = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const m = await me(ctx);
    if (!m?.profile) throw new ConvexError("No profile");
    await vetFile(ctx, storageId, m.profile);
  },
});

/** The write half of attachImage. Internal: only that action, which has looked inside the file, can call it. */
export const setImage = internalMutation({
  args: { field: v.union(v.literal("avatar"), v.literal("banner")), storageId: v.id("_storage") },
  handler: async (ctx, { field, storageId }) => {
    const m = await me(ctx);
    if (!m?.profile) throw new ConvexError("No profile");
    if (await vetFile(ctx, storageId, m.profile)) await ctx.db.insert("uploads", { storageId, profileId: m.profile._id });
    await ctx.db.patch(m.profile._id, { [field === "avatar" ? "avatarStorageId" : "bannerStorageId"]: storageId, updatedAt: Date.now() });
  },
});

/**
 * Removes an upload that attachImage refused, so refused files do not pile up in storage. It only ever
 * deletes what a just-refused upload looks like: a file from the last few minutes that has no owner on
 * record and that no page shows. Anything else is left alone, whatever the reason it was refused.
 */
export const discardUpload = internalMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    const meta = await ctx.db.system.get(storageId);
    if (!meta || Date.now() - meta._creationTime > FRESH_UPLOAD_MS) return;
    if (await ctx.db.query("uploads").withIndex("by_storage", (q) => q.eq("storageId", storageId)).unique()) return;
    if (await fileTaken(ctx, storageId)) return;
    await ctx.storage.delete(storageId);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const m = await me(ctx);
    if (!m?.profile) throw new ConvexError("No profile");
    const day = new Date().toISOString().slice(0, 10);
    const used = m.profile.uploadDay === day ? m.profile.uploadCount ?? 0 : 0;
    if (used >= MAX_UPLOADS_PER_DAY) throw new ConvexError("Too many uploads today. Try again tomorrow.");
    await ctx.db.patch(m.profile._id, { uploadDay: day, uploadCount: used + 1 });
    return ctx.storage.generateUploadUrl();
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
