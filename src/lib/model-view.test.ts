import { describe, expect, it } from "vitest";
import { computeIndex, defaultConfig } from "@/engine";
import { clientSnapshot, coreSnapshot } from "@/data/client-snapshot";
import { loadSnapshot } from "@/data/load";
import { packSnapshot, unpackSnapshot } from "@/data/packed-snapshot";
import { benchRows, chosenView, defaultPreset, modelView, otherField, presetConfig } from "./model-view";
import { rankingOptions } from "./model-ranking-param";

describe("model view", async () => {
  const full = (await loadSnapshot())!;
  const config = defaultConfig(full);
  const id = computeIndex(full, { ...config, variants: "all" }).ranked[0].model.id;

  it("matches what the index and the benchmark rows say", () => {
    const view = modelView(full, id, config, config);
    const ranked = computeIndex(full, { ...config, variants: "all" }).ranked;
    expect(view.mine.map((r) => [r.id, r.score, r.rank])).toEqual(ranked.flatMap((r, i) => (r.model.id === id ? [[r.variant.id, r.score, i + 1]] : [])));
    expect(view.total).toBe(ranked.length);
    expect(view.place).toBe(0);
    for (const b of view.field.benchmarks) {
      const rows = benchRows(view.field, b);
      expect(rows.some((r) => r.modelId === id)).toBe(true);
      expect(rows.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
      const sorted = [...rows.map((r) => r.value)].sort((p, q) => (b.higherIsBetter === false ? p - q : q - p));
      expect(rows.map((r) => r.value)).toEqual(sorted);
    }
  });

  it("sends the long benchmark list only on request, and every chart's points either way", () => {
    const server = modelView(full, id, config, config);
    expect(server.otherField).toBeUndefined();
    const inline = modelView(full, id, config, config, { inlineOthers: true });
    expect(otherField(full, id, config, config)).toEqual(inline.otherField);
    expect(server.others).toBe(inline.otherField!.benchmarks.length);
    expect(server.measured).toBe(server.field.benchmarks.length + server.others);
    // A row travels for each model once per metric at most, and this model's efforts always do.
    expect(server.cost.rows.filter((r) => r.modelId === id).map((r) => r.id)).toEqual(server.mine.map((r) => r.id));
    expect(JSON.stringify(server).length).toBeLessThan(200_000);
  });

  it("the browser's trimmed dataset gives the same view the server sends", () => {
    const wire = unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(coreSnapshot(full)))));
    const options = rankingOptions(null, []);
    const key = defaultPreset(full, id);
    const server = modelView(full, id, presetConfig(full, key), config, { inlineOthers: true });
    const browser = chosenView(wire, id, options, options.find((o) => o.key === key), true, (c) => c);
    expect(JSON.parse(JSON.stringify(browser.view))).toEqual(JSON.parse(JSON.stringify(server)));
    expect(browser.key).toBe(key);
  });

  it("the plain core snapshot is untouched for tabs on an older bundle", () => {
    expect(clientSnapshot(full).observations.some((o) => o.ci)).toBe(true);
  });
});

describe("a benchmark scored on each model's best setting", () => {
  it("reaches the model page, so it can't be read as one effort", async () => {
    const { loadSnapshot } = await import("@/data/load");
    const full = structuredClone((await loadSnapshot())!);
    const eci = full.benchmarks.find((b) => b.id === "epoch-eci")!;
    eci.effortBasis = "best-measured";
    const id = full.variants.find((v) => full.observations.some((o) => o.benchmarkId === eci.id && o.variantId === v.id))!.modelId;
    const config = defaultConfig(full);
    const view = modelView(full, id, config, config, { inlineOthers: true });
    expect([...view.field.benchmarks, ...(view.otherField?.benchmarks ?? [])].find((b) => b.id === eci.id)?.effortBasis).toBe("best-measured");
  });
});
