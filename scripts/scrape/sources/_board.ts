/** Shared bits for leaderboard pages that print "Model (effort) (with tools)" labels. */
const EFFORT_WORD = /^(none|minimal|low|medium|med|high|xhigh|x-high|extra-high|max|adaptive\/max)(?:\s+reasoning)?$/i;
const EFFORTS: Record<string, string> = { med: "medium", "x-high": "xhigh", "extra-high": "xhigh", "adaptive/max": "max" };

export const effortOf = (word: string): string | undefined => {
  const w = word.trim().toLowerCase();
  if (!EFFORT_WORD.test(w)) return undefined;
  const base = w.replace(/\s+reasoning$/, "");
  return EFFORTS[base] ?? base;
};

/** "Fable 5 (max) (with tools)" → label "Fable 5", effort "max", tools true. Unknown parentheticals stay in the label. */
export function splitLabel(raw: string): { label: string; effort?: string; tools: boolean } {
  let rest = raw.replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(), effort: string | undefined, tools = false;
  for (;;) {
    const m = rest.match(/\s*\(([^()]*)\)\s*$/);
    if (!m) break;
    const inner = m[1].trim();
    if (/^(with|w\/)\s*(python\s*)?tools?$/i.test(inner)) tools = true;
    else if (/^(w\/o|without|no)\s*tools?$/i.test(inner)) tools = false;
    else if (effortOf(inner) && !effort) effort = effortOf(inner);
    else break;
    rest = rest.slice(0, m.index).trim();
  }
  return { label: rest, effort, tools };
}

export const text = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
