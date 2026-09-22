import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const indexConfig = v.object({
  id: v.string(),
  name: v.string(),
  weights: v.record(v.string(), v.number()),
  required: v.array(v.string()),
  cutoff: v.number(),
  estimateMissing: v.boolean(),
  variants: v.union(v.literal("all"), v.literal("best")),
  effortMatching: v.optional(v.union(v.literal("calibrated"), v.literal("nearest"), v.literal("strict"))),
  strictness: v.optional(v.number()),
  optional: v.optional(v.array(v.string())),
  rankingVariants: v.optional(v.union(v.literal("all"), v.literal("best"))),
  paretoVariants: v.optional(v.union(v.literal("all"), v.literal("best"))),
  labs: v.optional(v.array(v.string())),
  excludeModels: v.optional(v.array(v.string())),
  releasedAfter: v.optional(v.string()),
});

/** A page is a list of sections; the editor and the agent skill both manipulate this. */
const section = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("rankings"), v.literal("pareto"), v.literal("speed"), v.literal("benchmark"),
    v.literal("text"), v.literal("links"), v.literal("history"), v.literal("gallery"),
  ),
  title: v.optional(v.string()),
  indexId: v.optional(v.string()), // rankings/pareto/speed/history
  benchmarkId: v.optional(v.string()), // benchmark
  body: v.optional(v.string()), // text (markdown-lite)
  links: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
  hidden: v.optional(v.boolean()),
});

export default defineSchema({
  profiles: defineTable({
    clerkId: v.string(),
    handle: v.string(), // lowercase, [a-z0-9-]{2,30}
    displayName: v.string(),
    avatarUrl: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
    bio: v.optional(v.string()),
    socials: v.optional(v.array(v.object({ label: v.string(), url: v.string() }))),
    indices: v.array(indexConfig),
    sections: v.array(section),
    theme: v.optional(v.object({ accent: v.optional(v.string()), surface: v.optional(v.union(v.literal("bone"), v.literal("white"))), serif: v.optional(v.string()), mono: v.optional(v.string()), css: v.optional(v.string()) })),
    /** API token hash for agent writes (skill). */
    agentTokenHash: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_clerk", ["clerkId"]).index("by_handle", ["handle"]).index("by_token", ["agentTokenHash"]),

  /** User-imported benchmark data (from the skill / JSON upload). Merged into the snapshot at render time. */
  imports: defineTable({
    profileId: v.id("profiles"),
    benchmark: v.any(), // Benchmark
    rows: v.any(), // RawRow[] (normalized at read time)
    createdAt: v.number(),
  }).index("by_profile", ["profileId"]),

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
