import { describe, expect, it } from "vitest";
import type { PlanSubsidy, SubsidySeller } from "./model-availability";
import { chunk, dollarScale, feeShort, feeText, gridPlans, gridRows, isClosedPlan, logShare, mainLab, nearestMark, rowPlanOf, scaleHigh, searchSellers, shortOf, times, trackMarks, usd, usdc, modelsOf } from "./plan-subsidies";

const model = (id: string, multiple?: number, lab = "anthropic") => ({ id, name: id.toUpperCase(), lab, ...(multiple != null ? { multiple } : {}) });
const plan = (name: string, feeUsd: number | undefined, models: ReturnType<typeof model>[]): PlanSubsidy => {
  const xs = models.flatMap((m) => m.multiple ?? []).sort((a, b) => a - b);
  return { plan: name, feeUsd, median: xs.length ? xs[xs.length >> 1] : 0, models };
};
const seller = (name: string, plans: PlanSubsidy[]): SubsidySeller => ({ id: name.toLowerCase(), name, plans });

describe("number text", () => {
  it("writes multiples, fees and dollars", () => {
    expect([times(3.14), times(9.96), times(10.4), times(99.6)]).toEqual(["3.1x", "10x", "10x", "100x"]);
    expect([feeText(20), feeText(199.99), feeText(undefined)]).toEqual(["$20/mo", "$199.99/mo", ""]);
    expect([feeShort(20), feeShort(0.99), feeShort(undefined)]).toEqual(["$20", "$0.99", ""]);
    expect([usd(4.5), usd(42.4), usd(3234.2)]).toEqual(["$4.50", "$42", "$3,234"]);
  });
  it("shortens dollars from a thousand up", () => {
    expect([usdc(999), usdc(1000), usdc(1250), usdc(5300), usdc(12600)]).toEqual(["$999", "$1k", "$1.3k", "$5.3k", "$13k"]);
  });
});

describe("plan names", () => {
  it("drops the words every plan shares and the legacy tag", () => {
    const s = seller("Anthropic", [plan("Claude Max 20x", 200, []), plan("Claude Pro", 20, []), plan("Claude Max 5x, legacy", 100, [])]);
    const short = shortOf(s);
    expect([short("Claude Max 20x"), short("Claude Pro"), short("Claude Max 5x, legacy")]).toEqual(["Max 20x", "Pro", "Max 5x"]);
    expect(shortOf(s)).toBe(short);
  });
  it("keeps full names when the short ones would read alike, and for one plan", () => {
    const s = seller("Cursor", [plan("Cursor Pro", 20, []), plan("Cursor Pro, legacy", 20, [])]);
    expect(shortOf(s)("Cursor Pro")).toBe("Cursor Pro");
    expect(shortOf(seller("Solo", [plan("Solo Basic", 5, [])]))("Solo Basic")).toBe("Solo Basic");
  });
  it("tells a closed plan", () => {
    expect([isClosedPlan("ChatGPT Pro, legacy"), isClosedPlan("Claude Max (existing subscribers)"), isClosedPlan("Claude Pro")]).toEqual([true, true, false]);
  });
  it("picks the first plan with figures for the row", () => {
    const a = plan("A", 10, [model("x")]), b = plan("B", 20, [model("y", 5)]);
    expect(rowPlanOf([a, b])).toBe(b);
    expect(rowPlanOf([a])).toBe(a);
  });
});

describe("search", () => {
  const sellers = [seller("Anthropic", [plan("Claude Pro", 20, [model("opus", 99), model("haiku", 40)]), plan("Claude Max", 100, [model("opus", 60)])]), seller("OpenAI", [plan("ChatGPT Plus", 20, [model("gpt", 30, "openai")])])];
  it("shows everything for an empty query, nothing opened by it", () => {
    const hits = searchSellers(sellers, "  ");
    expect(hits.map((h) => h.s.name)).toEqual(["Anthropic", "OpenAI"]);
    expect(hits.every((h) => !h.deep && h.models == null)).toBe(true);
  });
  it("keeps every plan when the company name matched", () => {
    const [h] = searchSellers(sellers, "anthro");
    expect(h.plans).toHaveLength(2);
    expect(h.deep).toBe(false);
  });
  it("narrows to the plans and models that matched, and opens the row", () => {
    const hits = searchSellers(sellers, "haiku");
    expect(hits).toHaveLength(1);
    expect(hits[0].deep).toBe(true);
    expect(hits[0].plans.map((p) => p.plan)).toEqual(["Claude Pro"]);
    expect(modelsOf(hits[0], hits[0].plans[0]).map((m) => m.id)).toEqual(["haiku"]);
  });
  it("matches a plan name with the company name, every word", () => {
    expect(searchSellers(sellers, "openai plus")[0].plans).toHaveLength(1);
    expect(searchSellers(sellers, "zzqq")).toEqual([]);
  });
});

describe("scales", () => {
  it("stretches the axis past 100x only when a figure needs it", () => {
    expect(scaleHigh([seller("A", [plan("A", 1, [model("x", 40)])])])).toBe(100);
    expect(scaleHigh([seller("A", [plan("A", 1, [model("x", 400)])])])).toBe(400);
    expect(logShare(100, 100)).toBe(1);
    expect(logShare(0.5, 100)).toBe(0);
    expect(logShare(10, 100)).toBeCloseTo(0.5);
  });
  it("makes a dollar scale from $5 to $30k that clamps", () => {
    const d = dollarScale([seller("A", [plan("A", 20, [model("x", 50)])])]);
    expect([d.lo, d.hi]).toEqual([5, 30000]);
    expect(d.share(5)).toBe(0);
    expect(d.share(30000)).toBe(1);
    expect(d.share(1)).toBe(0);
    expect(d.share(1e6)).toBe(1);
  });
  it("widens the dollar scale for a cheaper fee than $5", () => {
    const d = dollarScale([seller("A", [plan("A", 0.99, [model("x", 2)])])]);
    expect(d.lo).toBeCloseTo(0.99);
  });
});

describe("company bars", () => {
  const p = plan("Pro", 20, [model("opus", 99), model("sonnet", 60), model("haiku", 40)]);
  it("marks the median and the best model", () => {
    const marks = trackMarks(p, (m) => logShare(m, 100), 200);
    expect(marks.map((m) => m.k)).toEqual(["median", "best"]);
    expect(marks[0].text).toBe("median 60x");
    expect(marks[1].text).toBe("OPUS 99x best");
    expect(marks[1].x).toBeGreaterThan(marks[0].x);
  });
  it("names a lone model without 'best' and has no marks when nothing is measured", () => {
    expect(trackMarks(plan("One", 5, [model("solo", 12)]), (m) => logShare(m, 100), 100)[1].text).toBe("SOLO 12x");
    expect(trackMarks(plan("None", 5, [model("x")]), (m) => logShare(m, 100), 100)).toEqual([]);
  });
  it("finds the mark under the pointer within reach", () => {
    const marks = [{ x: 10 }, { x: 100 }];
    expect(nearestMark(marks, 20, 16)).toBe(marks[0]);
    expect(nearestMark(marks, 60, 16)).toBeNull();
    expect(nearestMark([], 5, 16)).toBeNull();
  });
  it("colours a bar by the lab with most of the plan's models", () => {
    expect(mainLab(plan("P", 1, [model("a", 1, "x"), model("b", 2, "y"), model("c", 3, "y")]))).toBe("y");
    expect(mainLab(plan("P", 1, [model("a")]))).toBe("");
  });
});

describe("plan grid", () => {
  const pro = plan("Pro", 20, [model("opus", 99), model("sonnet", 60), model("fable"), model("gemma", 50)]);
  const max = plan("Max", 100, [model("opus", 60), model("sonnet", 77), model("haiku", 55)]);
  const empty = plan("Empty", 5, [model("opus")]);
  const hit = searchSellers([seller("Anthropic", [pro, max, empty])], "")[0];
  it("makes a column of each plan that has a figure", () => {
    expect(gridPlans(hit)).toEqual([pro, max]);
  });
  it("orders rows by best figure, then name, and drops models no plan measured", () => {
    expect(gridRows(hit, [pro, max], null).map((r) => r.m.id)).toEqual(["opus", "sonnet", "haiku", "gemma"]);
    expect(gridRows(hit, [pro, max], null)[0].cells.size).toBe(2);
  });
  it("puts the sorted plan's figures first and models it lacks last", () => {
    expect(gridRows(hit, [pro, max], "Max").map((r) => r.m.id)).toEqual(["sonnet", "opus", "haiku", "gemma"]);
    expect(gridRows(hit, [pro, max], "Pro").map((r) => r.m.id)).toEqual(["opus", "sonnet", "gemma", "haiku"]);
  });
  it("narrows rows to a search's models", () => {
    const h = searchSellers([seller("Anthropic", [pro, max])], "sonnet")[0];
    expect(gridRows(h, [pro, max], null).map((r) => r.m.id)).toEqual(["sonnet"]);
  });
  it("splits columns into tables of six, or three on a phone", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([[1, 2, 3, 4, 5, 6], [7]]);
    expect(chunk([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
