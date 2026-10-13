import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { indexConfig, profileTheme, section } from "./validators";



export default defineSchema({
  profiles: defineTable({
    clerkId: v.string(),
    handle: v.string(), // lowercase, [a-z0-9-]{2,30}
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    bannerStorageId: v.optional(v.id("_storage")),
    /** Upload links handed out on `uploadDay` (UTC), for the daily cap in generateUploadUrl. */
    uploadDay: v.optional(v.string()),
    uploadCount: v.optional(v.number()),
    bio: v.optional(v.string()),
    socials: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
    indices: v.array(indexConfig),
    sections: v.array(section),
    theme: v.optional(profileTheme),
    /** API token hash for agent writes (skill). */
    agentTokenHash: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_clerk", ["clerkId"]).index("by_handle", ["handle"]).index("by_token", ["agentTokenHash"])
    // Which page shows a stored file, for images attached before `uploads` recorded their owner (fileTaken in profiles.ts).
    .index("by_avatar", ["avatarStorageId"]).index("by_banner", ["bannerStorageId"]),

  /** Who uploaded a stored image: written when a page first attaches it, checked ever after (claimFile in profiles.ts). */
  uploads: defineTable({ storageId: v.id("_storage"), profileId: v.id("profiles") }).index("by_storage", ["storageId"]).index("by_profile", ["profileId"]),

  /** User-imported benchmark data (from the skill / JSON upload). Merged into the snapshot at render time. */
  imports: defineTable({
    profileId: v.id("profiles"),
    benchmark: v.any(), // Benchmark
    rows: v.any(), // RawRow[] (normalized at read time)
    createdAt: v.number(),
  }).index("by_profile", ["profileId"]),

  /** Mix assistant spend per UTC day (see agentBudget.ts). */
  agentSpend: defineTable({ day: v.string(), spentUsd: v.number(), reservedUsd: v.number(), calls: v.number(), requests: v.number() }).index("by_day", ["day"]),
  /** Mix assistant requests per signed-in user per UTC day. */
  agentUsers: defineTable({ userId: v.string(), day: v.string(), requests: v.number(), spentUsd: v.number() }).index("by_user_day", ["userId", "day"]),

  /** Completed onboarding lineups — anonymous, feeds the precomputed mix library. */
  lineups: defineTable({
    focus: v.string(),
    lineup: v.array(v.string()), // model ids in the user's requested order
    key: v.string(), // focus + "|" + lineup.join(",")
    weights: v.any(), // fitted benchmark weights
    strictness: v.number(),
    fitScore: v.number(),
    exact: v.boolean(),
    snapshotDate: v.string(),
    createdAt: v.number(),
  }).index("by_key", ["key"]),
});
