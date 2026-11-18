import { describe, expect, it } from "vitest";
import { LABELED_MODELS } from "./model-labels";
import { cleanLabel, normalizeLabel } from "./normalize";

const id = (label: string, effort?: string) => { const n = normalizeLabel(label, effort); return n.ok ? n.modelId : null; };

describe("labels matched by exact spelling", () => {
  it("resolves every listed label to its own model, and no spelling to two", () => {
    const owner = new Map<string, string>();
    for (const m of LABELED_MODELS) for (const l of m.labels) {
      expect(id(l), l).toBe(m.id);
      const key = cleanLabel(l), had = owner.get(key);
      expect(had === undefined || had === m.id, `${l}: ${had} and ${m.id}`).toBe(true);
      owner.set(key, m.id);
    }
  });
  it("matches current releases across boards and keeps their efforts", () => {
    expect(id("Ember-1")).toBe("ember-1");
    expect(id("ERNIE-5.5-Flash-Preview")).toBe("ernie-5.5-flash");
    expect(id("Daybreak Blue", "max")).toBe("gpt-daybreak-blue");
    const beam = normalizeLabel("Beam 1.0 (XHigh)");
    expect(beam).toMatchObject({ ok: true, modelId: "aa-reflection-beam", effort: "xhigh" });
    expect(normalizeLabel("ERNIE 5.5 Flash Preview")).toMatchObject({ releaseDate: "2026-11-11" });
    expect(id("k3.1-pro")).toBe("kimi-k3.1");
  });
  it("reads Claude's older naming, and tells the two Claude 3.5 Sonnets apart only by a date", () => {
    expect(id("Claude 3 Opus (20240229)")).toBe("claude-opus-3");
    expect(id("claude-3.7-sonnet (no thinking)")).toBe("claude-sonnet-3.7");
    expect(id("claude-4.5-haiku:nothinking")).toBe("claude-haiku-4.5");
    expect(id("Claude 3.5 Sonnet (20240620)")).toBe("claude-sonnet-3.5");
    expect(id("Claude 3.5 Sonnet (20241022)")).toBe("claude-sonnet-3.6");
    expect(id("Claude 3.5 Sonnet Latest")).toBe("claude-sonnet-3.6");
    expect(id("Claude 3.5 Sonnet")).toBeNull();
  });
  it("leaves stealth names, routers and other checkpoints unknown", () => {
    for (const label of ["Ox Alpha", "Polaris Alpha", "Multiple", "Copilot Fusion", "AI co-mathematician", "ERNIE-5.0-Preview (1203)", "Seed-2.1-pro 0915", "Muse Spark Open - Provider Adapter (XHigh)"]) expect(id(label), label).toBeNull();
  });
});
