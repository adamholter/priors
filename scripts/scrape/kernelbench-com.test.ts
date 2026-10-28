import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeLabel } from "../../src/data/normalize";
import { KERNELBENCH_COM, liveSlugs, parseKernelbenchCom, type KernelbenchIndex } from "./sources/kernelbench-com";

const index = (): KernelbenchIndex => JSON.parse(readFileSync(new URL("./fixtures/kernelbench-com-models.json", import.meta.url), "utf8"));
// The homepage links every listed model; glm-5.2 is retired (its page exists, it is off the boards).
const home = ["claude-sonnet-5-5", "claude-opus-5", "gemini-4-argon-high", "kinetic-0715", "qwen3.8-max", "gpt-5.6-sol"]
  .map((s) => `<a class="colchart-col no-underline" href="/models/${s}">x</a>`).join("") + `<a href="/models">Models</a><a href="/runs/rtxpro6000/abc">run</a>`;

describe("kernelbench.com boards", () => {
  it("reads the live roster from the homepage's model links", () => {
    expect([...liveSlugs(home)].sort()).toEqual(["claude-opus-5", "claude-sonnet-5-5", "gemini-4-argon-high", "gpt-5.6-sol", "kinetic-0715", "qwen3.8-max"]);
  });

  it("scores the full deck with only valid cells, as the site's chart formula does", () => {
    const rows = parseKernelbenchCom(index(), liveSlugs(home));
    const by = new Map(rows.map((r) => [`${r.benchmarkId}|${r.modelLabel}`, r]));
    // CUDA: four problems; Sonnet 5.5's sparse-attention cell is 1.36 (scored against a reference latency).
    expect(by.get(`${KERNELBENCH_COM.cuda.id}|Claude Sonnet 5.5`)).toMatchObject({ effort: "max", harness: "claude", labHint: "Anthropic", details: { passed: 4, total: 4 } });
    expect(by.get(`${KERNELBENCH_COM.cuda.id}|Claude Sonnet 5.5`)!.value).toBeCloseTo(62.48, 2);
    // Two of four passed: the failures count 0, the deck stays 4.
    expect(by.get(`${KERNELBENCH_COM.cuda.id}|Claude Opus 5`)!.value).toBeCloseTo(50.66, 2);
    // A reward-hack cell and an audit "bug" cell carry scores but are not valid.
    expect(by.get(`${KERNELBENCH_COM.hard.id}|Qwen 3.8 Max`)!.value).toBeCloseTo(19.43, 2);
    expect(by.get(`${KERNELBENCH_COM.hard.id}|Qwen 3.8 Max`)!.details).toMatchObject({ passed: 4, total: 6 });
    expect(by.get(`${KERNELBENCH_COM.cuda.id}|Kimi K3 (256k)`)!.value).toBeCloseTo(7.01, 2);
    // No effort on the board: the display name's "(High)" is kept for the normalizer.
    expect(by.get(`${KERNELBENCH_COM.cuda.id}|Gemini 4 Argon (High)`)!.effort).toBeUndefined();
  });

  it("leaves out retired models, boards a model never ran, and boards still awaiting audit", () => {
    const rows = parseKernelbenchCom(index(), liveSlugs(home));
    expect(rows.some((r) => r.sourceModelId === "glm-5.2")).toBe(false);
    expect(rows.filter((r) => r.sourceModelId === "claude-sonnet-5-5").map((r) => r.benchmarkId)).toEqual([KERNELBENCH_COM.cuda.id]);
    const pending = index();
    const gem = pending.models.find((m) => m.slug === "gemini-4-argon-high")!;
    for (const c of Object.values(gem.benches.cuda!.cells)) { c.verdict = "unaudited"; c.valid = false; }
    expect(parseKernelbenchCom(pending, liveSlugs(home)).some((r) => r.sourceModelId === "gemini-4-argon-high")).toBe(false);
  });

  it("every fixture label resolves to a known model", () => {
    const ids = parseKernelbenchCom(index(), liveSlugs(home)).map((r) => { const n = normalizeLabel(r.modelLabel, r.effort); return n.ok ? `${n.modelId}@${n.effort ?? ""}` : `unknown:${r.modelLabel}`; });
    expect(ids.sort()).toEqual(["claude-opus-5@max", "claude-opus-5@max", "claude-sonnet-5.5@max", "gemini-4@high", "gpt-5.6-sol@xhigh", "kimi-k3@", "kimi-k3@", "qwen-3.8-max@xhigh", "qwen-3.8-max@xhigh"]);
  });

  it("fails visibly when the index or the roster changes shape", () => {
    expect(() => parseKernelbenchCom({ benches: {}, models: [] } as never, liveSlugs(home))).toThrow();
    expect(() => parseKernelbenchCom(index(), new Set())).toThrow(/no models/);
    const noCuda = index(); delete noCuda.benches.cuda;
    expect(() => parseKernelbenchCom(noCuda, liveSlugs(home))).toThrow(/cuda/);
  });
});
