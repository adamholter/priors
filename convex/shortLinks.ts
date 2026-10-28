import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { pathHash, randomSlug, validPath, validSlug } from "./shortLinkPath";

/** New links per hour, all visitors together. Repeats of a link already stored are free (same slug back). */
const NEW_PER_HOUR = 600;

/**
 * Short slug for a same-origin path (pathname + search + hash). Anonymous, and the same path always gets the same slug.
 * The UI never blocks on it: when this throws, the long link is copied instead.
 */
export const create = mutation({
  args: { path: v.string() },
  returns: v.string(),
  handler: async (ctx, { path }) => {
    if (!validPath(path)) throw new Error("Invalid path.");
    const hash = await pathHash(path);
    const existing = await ctx.db.query("shortLinks").withIndex("by_hash", (q) => q.eq("hash", hash)).first();
    if (existing && existing.path === path) return existing.slug;
    const now = Date.now();
    const recent = await ctx.db.query("shortLinks").withIndex("by_created", (q) => q.gt("createdAt", now - 3_600_000)).take(NEW_PER_HOUR);
    if (recent.length >= NEW_PER_HOUR) throw new Error("Too many new links. Try again later.");
    for (let attempt = 0; attempt < 8; attempt++) {
      const slug = randomSlug();
      if (await ctx.db.query("shortLinks").withIndex("by_slug", (q) => q.eq("slug", slug)).first()) continue;
      await ctx.db.insert("shortLinks", { slug, path, hash, createdAt: now });
      return slug;
    }
    throw new Error("Could not allocate a slug.");
  },
});

/** The stored path for a slug, or null. */
export const resolve = query({
  args: { slug: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { slug }) => {
    if (!validSlug(slug)) return null;
    return (await ctx.db.query("shortLinks").withIndex("by_slug", (q) => q.eq("slug", slug)).first())?.path ?? null;
  },
});
