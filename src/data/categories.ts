import type { Benchmark, BenchmarkCategory } from "./types";

/**
 * What a benchmark tests, as a reader would file it. A benchmark can sit in several
 * (`Benchmark.categories`); the first is its main one (`Benchmark.category`), which groups it in
 * pickers and on charts. Order here is the display order.
 */
export const CATEGORIES: { id: BenchmarkCategory; name: string; blurb: string }[] = [
  { id: "coding", name: "Coding", blurb: "Writing, fixing and shipping software" },
  { id: "agentic", name: "Agents & computer use", blurb: "Multi-step work with tools: terminals, browsers, desktops, business apps, robots" },
  { id: "professional", name: "Professional work", blurb: "Finance, law, medicine, accounting and office deliverables" },
  { id: "science", name: "Science & research", blurb: "Physics, biology, chemistry, engineering and AI research" },
  { id: "math", name: "Math", blurb: "From school arithmetic to research-level proofs" },
  { id: "reasoning", name: "Reasoning & puzzles", blurb: "Logic, novel puzzles and common sense" },
  { id: "games", name: "Games & strategy", blurb: "Chess, poker, board and video games, running a simulated business" },
  { id: "knowledge", name: "Knowledge & accuracy", blurb: "Knowing facts, and not making them up" },
  { id: "vision", name: "Vision", blurb: "Understanding images, charts, video and physical space" },
  { id: "long-context", name: "Long documents", blurb: "Finding and using details across very long inputs" },
  { id: "creative", name: "Writing & design", blurb: "Stories, roleplay, visuals, 3D scenes and front-end design" },
  { id: "behavior", name: "Behavior & style", blurb: "Following instructions, personality, emotional intelligence, tone" },
  { id: "safety", name: "Safety & security", blurb: "Cyber defense, refusals, honesty and cheating" },
  { id: "multilingual", name: "Languages", blurb: "Performance outside English" },
  { id: "preference", name: "Human preference", blurb: "Which answer people pick in blind side-by-side votes" },
  { id: "composite", name: "Overall indexes", blurb: "One number combining many benchmarks" },
  { id: "cost", name: "Cost", blurb: "What it costs to run" },
  { id: "speed", name: "Speed", blurb: "How fast it answers" },
  { id: "reliability", name: "Reliability", blurb: "Uptime and error rates" },
  { id: "other", name: "Other", blurb: "Everything else" },
];

const BY_ID = new Map<string, (typeof CATEGORIES)[number]>(CATEGORIES.map((c) => [c.id, c]));
/** Category names snapshots saved before November 12, 2026 used. */
const LEGACY: Record<string, BenchmarkCategory> = { economics: "professional", instruction: "behavior" };

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
/** A stored category as today's id; an unknown one is "other". */
export const normalizeCategory = (c: string): BenchmarkCategory => (BY_ID.has(c) ? (c as BenchmarkCategory) : LEGACY[c] ?? "other");
export const categoryName = (c: string): string => BY_ID.get(normalizeCategory(c))!.name;
export const categoryBlurb = (c: string): string => BY_ID.get(normalizeCategory(c))!.blurb;
export const categoryOrder = (c: string): number => CATEGORY_IDS.indexOf(normalizeCategory(c));

/** Every category a benchmark sits in, main one first. */
export function categoriesOf(b: Pick<Benchmark, "category"> & { categories?: string[] }): BenchmarkCategory[] {
  const out: BenchmarkCategory[] = [];
  for (const c of [b.category, ...(b.categories ?? [])]) { const n = normalizeCategory(c); if (!out.includes(n)) out.push(n); }
  return out;
}
export const categoryNames = (b: Pick<Benchmark, "category"> & { categories?: string[] }): string => categoriesOf(b).map(categoryName).join(" · ");
