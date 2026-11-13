/**
 * Does a launch name land on its own model, or under an existing one? On 12 November 2026 "Gemini 4 Hydrogen" normalized to `gemini-4`
 * (Gemini 4 Argon) until a family rule was added, so its scores would have joined Argon's. Run it on any name a lab announces:
 * `npm run name-check -- "Gemini 4 Hydrogen" "GPT-6.2 Nova"`. The radar runs the same check on every model name it reads in a post.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeLabel } from "../../src/data/normalize";
import { missingWords } from "../scrape/label-collisions";
import type { Snapshot } from "../../src/data/types";

export interface NameCheck {
  name: string;
  /**
   * `swallowed`: it lands on an existing model whose id and name lack one of its words. `dropped`: a new id, but one that lacks a word of the
   * name ("GPT-6.2 Nova" as `gpt-6.2`), so a plain GPT-6.2 would later share it. `unknown`: no family rule, so its rows are excluded.
   */
  status: "existing" | "new" | "swallowed" | "dropped" | "unknown";
  modelId?: string;
  existingName?: string;
  extra?: string[];
}

export function checkName(name: string, models: { id: string; name: string }[]): NameCheck {
  const n = normalizeLabel(name);
  if (!n.ok) return { name, status: "unknown" };
  const m = models.find((x) => x.id === n.modelId);
  if (!m) {
    const extra = missingWords(name, { id: n.modelId, name: n.modelName }, "any");
    return extra.length ? { name, status: "dropped", modelId: n.modelId, extra } : { name, status: "new", modelId: n.modelId };
  }
  const extra = missingWords(name, m, "any");
  return { name, status: extra.length ? "swallowed" : "existing", modelId: m.id, existingName: m.name, ...(extra.length ? { extra } : {}) };
}

/** A name the radar raises: filed under a model, or an id, that lacks one of its words. */
export const isFlagged = (c: NameCheck) => c.status === "swallowed" || c.status === "dropped";

export function describeCheck(c: NameCheck): string {
  if (c.status === "unknown") return `${c.name} -> unknown (no family rule in src/data/normalize.ts; its rows are excluded until one is added)`;
  if (c.status === "new") return `${c.name} -> ${c.modelId} (new id, no model in the snapshot yet)`;
  if (c.status === "dropped") return `${c.name} -> ${c.modelId} (new id, no model in the snapshot yet)\n  WARNING: "${c.extra!.join(" ")}" is not in the id it gets. A later model without that word would share ${c.modelId}: add a rule to src/data/normalize.ts.`;
  const line = `${c.name} -> ${c.modelId} (existing model: ${c.existingName})`;
  return c.status === "existing" ? line : `${line}\n  WARNING: "${c.extra!.join(" ")}" is not in ${c.existingName}. A new model may be swallowed by an existing one: add a rule to src/data/normalize.ts.`;
}

export function loadSnapshot(file = process.env.PRIORS_SNAPSHOT || "data/snapshots/latest.json.gz"): Snapshot {
  return JSON.parse(gunzipSync(readFileSync(path.resolve(file))).toString()) as Snapshot;
}

if (process.argv[1]?.endsWith("name-check.ts")) {
  const names = process.argv.slice(2);
  if (!names.length) { console.error('usage: npm run name-check -- "Gemini 4 Hydrogen" ["GPT-6.2 Nova" ...]'); process.exit(2); }
  const { models } = loadSnapshot();
  const checks = names.map((n) => checkName(n, models));
  for (const c of checks) console.log(describeCheck(c));
  process.exitCode = checks.some(isFlagged) ? 1 : 0;
}
