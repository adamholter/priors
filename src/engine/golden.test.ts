import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { clientSnapshot } from "../data/client-snapshot";
import { packSnapshot, unpackSnapshot } from "../data/packed-snapshot";
import type { Snapshot } from "../data/types";
import { fitPriors } from "../onboarding/optimizer";
import { benchmarkQuality } from "../onboarding/quality";
import { GOLDEN_DATE, goldenConfigs, goldenJson, withVirtualClock } from "./golden-cases";
import { computeIndex, defaultConfig, PAGE_VIEW, type IndexResult } from "./index";

/**
 * The columnar engine against what the map-based one produced before it, byte for byte (src/engine/fixtures/expected.json,
 * written by scripts/verify/engine-goldens.mts): real data for one finished day, and a small fixture with the rarer row shapes.
 */
const FIXTURES = path.resolve("src/engine/fixtures");
const expected = JSON.parse(readFileSync(path.join(FIXTURES, "expected.json"), "utf8")) as { real: Record<string, string>; index: Record<string, string>; fit: Record<string, string>; lineup: string[] };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const clientOf = (s: Snapshot) => unpackSnapshot(JSON.parse(JSON.stringify(packSnapshot(clientSnapshot(s)))));
const mismatches = (s: Snapshot, cases: Snapshot, prefix: string, want: Record<string, string>) => goldenConfigs(cases, defaultConfig(cases), PAGE_VIEW)
  .filter(({ id, config, view }) => sha(goldenJson(computeIndex(s, config, view ?? {}))) !== want[`${prefix}/${id}`]).map((c) => c.id);

describe("golden outputs", () => {
  let dir: string, fixture: Snapshot;
  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "priors-golden-"));
    mkdirSync(path.join(dir, "data/snapshots"), { recursive: true });
    for (const f of readdirSync(FIXTURES)) if (f.endsWith(".json.gz")) cpSync(path.join(FIXTURES, f), path.join(dir, "data/snapshots", f));
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(dir);
    const { loadSnapshot } = await import("../data/load");
    fixture = (await loadSnapshot())!;
    cwd.mockRestore();
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("real data: full and client snapshots", async () => {
    const { readSnapshot } = await import("../data/load");
    const real = (await readSnapshot(GOLDEN_DATE))!;
    expect(mismatches(real, real, "full", expected.real)).toEqual([]);
    expect(mismatches(clientOf(real), real, "client", expected.real)).toEqual([]);
    expect(goldenConfigs(real, defaultConfig(real), PAGE_VIEW).some(({ config, view }) => computeIndex(real, config, view ?? {}).autoHidden.length)).toBe(true);
  });

  it("fixture: full and client snapshots, and it reaches the rare paths", () => {
    expect(mismatches(fixture, fixture, "full", expected.index)).toEqual([]);
    expect(mismatches(clientOf(fixture), fixture, "client", expected.index)).toEqual([]);
    const results: IndexResult[] = goldenConfigs(fixture, defaultConfig(fixture), PAGE_VIEW).map(({ config, view }) => computeIndex(fixture, config, view ?? {}));
    const values = results.flatMap((r) => r.ranked.flatMap((x) => x.values));
    expect(new Set(values.map((v) => v.estimateKind))).toEqual(new Set([undefined, "effort", "peer", "calibrated-fallback", "performance"]));
    expect(values.some((v) => v.effortFactor !== undefined && v.evidence?.length)).toBe(true);
    expect(values.some((v) => v.donors && v.donors.length > 5)).toBe(true); // both peer methods
    const evidence = new Set(values.flatMap((v) => v.evidence ?? []));
    for (const e of ["paired", "efforts", "calibration", "Release-specific paired calibration", "4 paired configurations", "Real Index Top-effort assumption; native effort not published"]) expect(evidence).toContain(e);
    expect(results.some((r) => r.excluded.some((x) => x.reason === "required")) && results.some((r) => r.excluded.some((x) => x.reason === "coverage"))).toBe(true);
    expect(results.some((r) => r.estimated.length) && results.some((r) => r.ranked.some((x) => x.costPlan))).toBe(true);
  });

  it("optimizer: the same fit, step by step, under a virtual clock", async () => {
    const quality = Object.fromEntries(benchmarkQuality(fixture).map((q) => [q.id, q.score]));
    for (const [id, lineup] of [["default", expected.lineup], ["reversed", [...expected.lineup].reverse()]] as const) {
      const updates: string[] = [];
      const done = await withVirtualClock(() => fitPriors(fixture, [...lineup], (u) => updates.push(JSON.stringify(u)), quality, 0, { baseline: [...lineup] }, { focus: "general", budgetMs: { soft: 400, hard: 800 } }));
      expect(sha(`${JSON.stringify(done)}\n${updates.join("\n")}`), id).toBe(expected.fit[id]);
    }
  });

  it("a list replaced or grown after the first ranking is ranked as it now stands", () => {
    const s: Snapshot = structuredClone(fixture), config = defaultConfig(s), benchmarkId = Object.keys(config.weights)[0];
    const row = computeIndex(s, config).ranked[0];
    s.observations.push({ benchmarkId, variantId: "fresh@high", value: 100, observedAt: "", sourceUrl: "" });
    s.variants.push({ id: "fresh@high", modelId: "fresh", effort: "high" });
    s.models.push({ ...row.model, id: "fresh", name: "Fresh" });
    expect(computeIndex(s, { ...config, strictness: 0 }).ranked.some((r) => r.model.id === "fresh")).toBe(true);
    s.observations = s.observations.filter((o) => o.variantId !== "fresh@high");
    expect(computeIndex(s, { ...config, strictness: 0 }).ranked.some((r) => r.model.id === "fresh")).toBe(false);
  });
});
