import type { Model } from "./types";
import { normalizeLabel } from "./normalize";

export interface OpenRouterCreated { id: string; name?: string; created?: number }

/** Known dates for models no source publishes one for (lab announcements). Beats the OpenRouter fallback. */
export const RELEASE_DATE_OVERRIDES: Record<string, string> = {
  "gpt-4.0314": "2023-03-14", "gpt-4.0613": "2023-06-13", "gpt-4.0125": "2024-01-25", "gpt-45": "2025-02-27", "codestral-25.01": "2025-01-13", "gemini-1206": "2024-12-06",
  "gemma-1.1-2b-it": "2024-04-05", "gemma-1.1-7b-it": "2024-04-05",
  "gemma-2-27b-it": "2024-06-27", "gemma-2-9b-it": "2024-06-27", "gemma-2-2b-it": "2024-07-31",
  "gemma-3-12b-it": "2025-03-12", "gemma-3-4b-it": "2025-03-12", "gemma-3-1b-it": "2025-03-12",
  "grok-2.2024": "2024-08-13", "grok-4.1": "2025-11-17", "kimi-k2.0711": "2025-07-11",
  "claude-sonnet-06.20": "2024-06-20", "claude-sonnet-10.22": "2024-10-22", "claude-sonnet-2024.10": "2024-10-22",
  "claude-sonnet-2025.02": "2025-02-24", "claude-sonnet-2025.05": "2025-05-22", "claude-opus-2025.05": "2025-05-22",
  "claude-opus-02": "2024-03-04", "claude-sonnet-02": "2024-03-04",
  "mistral-large-2407": "2024-07-24", "mistral-large-2411": "2024-11-18", "mistral-large-11": "2024-11-18", "mistral-large-24.11": "2024-11-18",
  "mistral-small-02": "2024-02-26", "mistral-large-24": "2024-02-26",
  // From the OpenRouter listing (earliest `created` of the family) where our id is a family name it doesn't carry.
  "mistral-3.5": "2026-04-30", "qwen-3.6": "2026-04-02", "qwen-3.7": "2026-06-03", "qwen-3.5-397b": "2026-02-16",
  "deepseek-v4": "2026-04-23", "kimi-k2.7": "2026-06-12", "qwen-2.5-plus": "2024-11-27", "gpt-5.3-codex-codex": "2026-02-24",
  // Vendor launch coverage (vals.ai, release write-ups).
  "composer-2.5": "2026-05-18", "swe-1.6": "2026-04-07", "swe-2": "2026-09-10",
};

const isoDay = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

/** Mistral ids end in the YYMM they shipped (devstral-2512, mistral-medium-2508). Month precision, first of the month. */
export function mistralSuffixDate(m: Pick<Model, "id" | "labId">): string | undefined {
  if (m.labId !== "mistral") return undefined;
  const hit = /-(\d{2})(\d{2})$/.exec(m.id);
  if (!hit) return undefined;
  const yy = Number(hit[1]), mm = Number(hit[2]);
  return yy >= 23 && yy <= 27 && mm >= 1 && mm <= 12 ? `20${hit[1]}-${hit[2]}-01` : undefined;
}

/** Earliest OpenRouter listing per canonical model id. */
export function openRouterDates(listing: OpenRouterCreated[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const l of listing) {
    if (!l.created || l.created < 1.6e9) continue;
    const day = isoDay(l.created);
    const labels = [l.name?.replace(/^[^:]+:\s*/, ""), l.id.split("/").pop()?.replace(/:.*$/, "")];
    for (const label of labels) {
      if (!label) continue;
      const n = normalizeLabel(label);
      if (!n.ok) continue;
      const prev = out.get(n.modelId);
      if (!prev || day < prev) out.set(n.modelId, day);
    }
  }
  return out;
}

/** Fills missing releaseDate: source hint (already set) > overrides > OpenRouter listing > Mistral YYMM suffix. */
export function fillReleaseDates(models: Model[], orDates: Map<string, string>): { filled: Record<"override" | "openrouter" | "suffix", string[]>; stillMissing: string[] } {
  const filled = { override: [] as string[], openrouter: [] as string[], suffix: [] as string[] };
  const stillMissing: string[] = [];
  for (const m of models) {
    if (m.releaseDate || m.kind !== "llm") continue;
    const via: [keyof typeof filled, string | undefined][] = [["override", RELEASE_DATE_OVERRIDES[m.id]], ["openrouter", orDates.get(m.id)], ["suffix", mistralSuffixDate(m)]];
    const hit = via.find(([, d]) => d);
    if (hit) { m.releaseDate = hit[1]; filled[hit[0]].push(m.id); } else stillMissing.push(m.id);
  }
  return { filled, stillMissing };
}
