import { describe, expect, it } from "vitest";
import type { BenchRow, ModelView } from "./model-view";
import { buildEfforts, byEffortDesc, bestValue, cardRows, effortIdx, fmtStep, placeOf, secs, tokens, usd } from "./model-efforts";

const mine = (rows: [string, string, number, number?][]): ModelView["mine"] => rows.map(([id, effort, score, measuredShare = 1], i) => ({ id, effort, score, rank: i + 1, measuredShare }));
const view = (m: ModelView["mine"], cost: Record<string, Partial<ModelView["cost"]["rows"][number]>> = {}, extra: Partial<ModelView> = {}) => ({
  model: { id: "m", name: "M" }, mine: m, total: 90, loose: false, costBasis: "api",
  cost: { rows: m.map((r) => ({ id: r.id, modelId: "m", name: "M", effort: r.effort, score: r.score, ...cost[r.id] })), floor: 0, hasFree: false, models: 1 },
  ...extra,
}) as Pick<ModelView, "mine" | "total" | "cost" | "model" | "loose" | "costBasis">;

describe("effort order", () => {
  it("runs from default to max and puts unknown labels last", () => {
    expect(["max", "mystery", "low", "default", "xhigh", "medium", "high", "none"].sort((a, b) => effortIdx(a) - effortIdx(b))).toEqual(["default", "none", "low", "medium", "high", "xhigh", "max", "mystery"]);
    expect(byEffortDesc([{ effort: "low" }, { effort: "max" }, { effort: "high" }]).map((r) => r.effort)).toEqual(["max", "high", "low"]);
  });
});

describe("best value", () => {
  const r = (id: string, effort: string, score: number, cost?: number) => ({ id, effort, score, cost });
  it("is the cheapest effort within 5% of the top score", () => {
    expect(bestValue([r("a", "max", 64.7, 0.15), r("b", "high", 61.9, 0.049), r("c", "low", 53.9, 0.03)])).toBe("b");
  });
  it("is the top effort when nothing cheaper is close, and breaks cost ties toward the lower effort", () => {
    expect(bestValue([r("a", "max", 80, 1), r("b", "low", 50, 0.1)])).toBe("a");
    expect(bestValue([r("a", "max", 80, 0.5), r("b", "high", 79, 0.5)])).toBe("b");
  });
  it("needs two priced efforts", () => {
    expect(bestValue([r("a", "max", 80, 1), r("b", "low", 50)])).toBeNull();
    expect(bestValue([r("a", "max", 80), r("b", "low", 50)])).toBeNull();
  });
  it("counts a free effort as priced", () => {
    expect(bestValue([r("a", "max", 80, 0), r("b", "low", 79, 0.2)])).toBe("a");
  });
});

describe("effort rows", () => {
  it("lists highest effort first with the step over the effort below and marks the best value", () => {
    const d = buildEfforts(view(mine([["a", "max", 64.7], ["b", "xhigh", 62.2], ["c", "high", 61.9], ["d", "low", 53.9]]), { a: { costUsd: 0.15, tpt: 600, tokens: 274000 }, b: { costUsd: 0.077 }, c: { costUsd: 0.049 }, d: { costUsd: 0.03 } }));
    expect(d.list.map((r) => r.effort)).toEqual(["max", "xhigh", "high", "low"]);
    expect(d.list.map((r) => r.step)).toEqual([2.5, 0.3, 8, null]);
    expect(d.best).toBe("c");
    expect(d.list.find((r) => r.best)?.effort).toBe("high");
    expect(d).toMatchObject({ hasCost: true, hasTime: true, hasTokens: true, plan: false, total: 90 });
  });
  it("steps from the displayed one-decimal scores so the column adds up", () => {
    const d = buildEfforts(view(mine([["a", "high", 50.06], ["b", "low", 49.94]])));
    expect(d.list[0].step).toBe(0.2);
  });
  it("leaves out columns nobody measured and still lists efforts without a cost", () => {
    const d = buildEfforts(view(mine([["a", "high", 60], ["b", "low", 50]])));
    expect(d).toMatchObject({ hasCost: false, hasTime: false, hasTokens: false, best: null });
    expect(d.list).toHaveLength(2);
  });
  it("reads a negative cost as missing, keeps zero, and ignores other models' cost rows", () => {
    const v = view(mine([["a", "high", 60], ["b", "low", 50]]), { a: { costUsd: -1 }, b: { costUsd: 0 } });
    v.cost.rows.push({ id: "a", modelId: "other", name: "O", effort: "high", score: 1, costUsd: 9 });
    const d = buildEfforts(v);
    expect(d.list.map((r) => r.cost)).toEqual([undefined, 0]);
  });
  it("marks estimates only in a loose ranking, and the plan basis", () => {
    const m = mine([["a", "high", 60, 0.4], ["b", "low", 50, 1]]);
    expect(buildEfforts(view(m)).list.map((r) => r.est)).toEqual([false, false]);
    const d = buildEfforts(view(m, {}, { loose: true, costBasis: "subscription" }));
    expect(d.list.map((r) => r.est)).toEqual([true, false]);
    expect(d.plan).toBe(true);
  });
});

describe("benchmark card rows", () => {
  const row = (effort: string, rank: number): BenchRow => ({ variantId: effort, modelId: "m", effort, value: 100 - rank, rank });
  it("orders efforts high to low and marks the best placed one", () => {
    const { rows, best, single } = cardRows({}, [row("low", 3), row("max", 9), row("high", 1)]);
    expect(rows.map((r) => r.effort)).toEqual(["max", "high", "low"]);
    expect(best?.effort).toBe("high");
    expect(single).toBe(false);
  });
  it("is single for one effort or a benchmark with its own setting", () => {
    expect(cardRows({}, [row("high", 2)]).single).toBe(true);
    expect(cardRows({ effortBasis: "best" } as never, [row("high", 2), row("low", 3)]).single).toBe(true);
  });
  it("places a rank from 1 (beat all) to 0 (last) and handles a single result", () => {
    expect([placeOf(1, 11), placeOf(6, 11), placeOf(11, 11), placeOf(1, 1)]).toEqual([1, 0.5, 0, 1]);
  });
});

describe("formatters", () => {
  it("keeps neighbouring costs apart", () => {
    expect([usd(0), usd(0.0042), usd(0.029), usd(0.03), usd(0.15), usd(1), usd(2.46), usd(12.4)]).toEqual(["free", "$0.0042", "$0.029", "$0.030", "$0.15", "$1", "$2.5", "$12"]);
  });
  it("formats time, tokens and steps", () => {
    expect([secs(2.7), secs(10), secs(240), secs(660)]).toEqual(["2.7s", "10s", "4.0 min", "11 min"]);
    expect([tokens(950), tokens(2400), tokens(98000), tokens(274000)]).toEqual(["950", "2.4k", "98k", "274k"]);
    expect([fmtStep(5.6), fmtStep(0), fmtStep(-1.2)]).toEqual(["+5.6", "+0.0", "-1.2"]);
  });
});
