import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { indexConfig, profileTheme, section, storableIndex } from "./validators";
import { ConvexError, v } from "convex/values";
import type { IndexConfig } from "../src/engine";

const HANDLE = /^[a-z0-9][a-z0-9-]{1,29}$/;
const RESERVED = new Set(["sign-in", "sign-up", "api", "skill", "import", "me", "og", "about", "admin", "priors", "u", "settings", "privacy", "terms", "builder", "claim", "models"]);

async function me(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const profile = await ctx.db.query("profiles").withIndex("by_clerk", (q) => q.eq("clerkId", identity.subject)).unique();
  return { identity, profile };
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
    const { agentTokenHash: _h, ...rest } = p; void _h;
    return { ...rest, avatarUrl: avatarUrl ?? undefined, bannerUrl: bannerUrl ?? undefined, imports: imports.map((i) => ({ benchmark: i.benchmark, rows: i.rows })) };
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
      displayName: v.optional(v.string()), bio: v.optional(v.string()), avatarUrl: v.optional(v.string()), avatarStorageId: v.optional(v.id("_storage")), bannerStorageId: v.optional(v.union(v.id("_storage"), v.null())),
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

export const generateUploadUrl = mutation({ args: {}, handler: async (ctx) => { if (!(await me(ctx))?.profile) throw new Error("No profile"); return ctx.storage.generateUploadUrl(); } });

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
