import { z } from "zod";

/** Schema for user/agent-provided benchmark data. Mirrors Benchmark + RawRow from the data contract. */
export const importSchema = z.object({
  benchmark: z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,60}$/, "lowercase slug"),
    name: z.string().min(1).max(80),
    shortName: z.string().max(30).optional(),
    url: z.string().url(),
    description: z.string().min(10).max(600),
    unit: z.enum(["percent", "score", "elo", "usd", "seconds", "count"]),
    higherIsBetter: z.boolean(),
    category: z.enum(["coding", "agentic", "reasoning", "knowledge", "math", "long-context", "instruction", "creative", "safety", "economics", "composite", "speed", "cost", "reliability", "other"]),
  }),
  rows: z.array(z.object({
    modelLabel: z.string().min(1),
    effort: z.string().optional(),
    value: z.number().finite(),
    ci: z.tuple([z.number(), z.number()]).optional(),
    costUsd: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    steps: z.number().nonnegative().optional(),
    sourceUrl: z.string().url(),
    note: z.string().max(300).optional(),
  })).min(1),
  /** Models the agent looked for but could not find a score for. Kept for transparency. */
  missing: z.array(z.object({ modelLabel: z.string(), reason: z.string().optional() })).optional(),
});
export type ImportPayload = z.infer<typeof importSchema>;

export { mergeImports } from "./import-merge";
