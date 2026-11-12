import type { Entry, Rule } from "./types";
import type { BenchmarkCategory } from "../types";

const VOTES = "Measures what people prefer, not what is correct.";
export const ARENA: Record<string, Entry> = {
  "arena-agent": { c: ["agentic", "preference"], d: "How much a model improves real agent sessions on Arena, estimated from millions of live sessions: task success, praise versus complaints, taking corrections, and clean shell and tool use. A percentage with a 95% interval, not a rating." },
  "arena-document": { c: ["long-context", "preference"], d: `Which answer people prefer when asking about uploaded documents and other long content, from blind side-by-side votes on Arena. ${VOTES}` },
  "arena-search": { c: ["knowledge", "preference"], d: `Which answer people prefer from models that can search the web, from blind side-by-side votes on Arena. ${VOTES}` },
  "arena-text": { c: ["preference"], d: `Which answer people prefer on everyday text prompts: users see two anonymous models side by side and vote. A rating from those votes, adjusted so length and formatting do not sway it. ${VOTES}` },
  "arena-vision": { c: ["vision", "preference"], d: `Which answer people prefer on prompts that include an image, from blind side-by-side votes on Arena. ${VOTES}` },
  "arena-image-to-webdev": { c: ["coding", "creative", "vision", "preference"], d: "Which web app people prefer when two anonymous models each build a working front end from an image of the design. A rating from blind votes on Arena." },
  "arena-webdev": { c: ["coding", "creative", "preference"], d: "Which web app people prefer: two anonymous models each build a working front end from the same prompt and users vote. A rating from those votes." },
};

/** What an Arena category slice adds to its board's categories. */
const SLICE: [RegExp, BenchmarkCategory][] = [
  [/coding|software/, "coding"], [/math/, "math"], [/creative-writing|writing-and-literature/, "creative"], [/legal|medicine|business/, "professional"], [/life-and-physical/, "science"],
  [/instruction-following/, "behavior"], [/chinese|french|german|japanese|korean|polish|russian|spanish|non-english/, "multilingual"],
];
const slice = (id: string): BenchmarkCategory[] => SLICE.filter(([re]) => re.test(id)).map(([, c]) => c);
const label = (name: string) => name.split(" · ")[1] ?? name;

export const ARENA_RULES: Rule[] = [
  { match: /^arena-agent-/, c: ["agentic", "preference"] },
  { match: /^arena-text-/, c: (b) => ["preference", ...slice(b.id)], d: (b) => `The "${label(b.name)}" slice of Arena Text: which of two anonymous answers people prefer, counting only those prompts. ${VOTES}` },
  { match: /^arena-vision-/, c: (b) => ["vision", "preference", ...slice(b.id)], d: (b) => `The "${label(b.name)}" slice of Arena Vision: which of two anonymous answers people prefer on prompts with an image, counting only those prompts. ${VOTES}` },
  { match: /^arena-(webdev-|image-to-webdev)/, c: ["coding", "creative", "preference"], d: (b) => `The "${label(b.name)}" slice of Arena WebDev: which of two anonymous models' working front ends people prefer, counting only those prompts.` },
];
