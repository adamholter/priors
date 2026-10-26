import { describe, expect, it } from "vitest";
import { compileFormula, formulaName } from "./formula";

const KNOWN = ["score", "cost", "time", "speed"];
const run = (src: string, vars = { score: 60, cost: 2, time: 30, speed: 100 }) => { const f = compileFormula(src, KNOWN); if (!f.ok) throw new Error(f.error); return f.evaluate(vars); };
const error = (src: string) => { const f = compileFormula(src, KNOWN); return f.ok ? "" : f.error; };

describe("compileFormula", () => {
  it("follows arithmetic precedence and associativity", () => {
    expect(run("score / (cost * time)")).toBe(1);
    expect(run("1 + 2 * 3 + cost")).toBe(9);
    expect(run("2 ^ 3 ^ cost")).toBe(512);
    expect(run("-2 ^ 2 + score")).toBe(56);
    expect(run("2 ^ -1 * score")).toBe(30);
    expect(run("10 - 4 - 3 + cost")).toBe(5);
    expect(run("1e2 * .5 + cost")).toBe(52);
  });
  it("reads formulas the way people write them", () => {
    expect(run("Intelligence / (Cost_per_Task × Time_per_Task)")).toBe(1);
    expect(run("SCORE ÷ cost − 1")).toBe(29);
    expect(run("score ** 2")).toBe(3600);
    expect(formulaName("Time per task")).toBe("time");
  });
  it("supports functions and constants", () => {
    expect(run("log(cost * 50)")).toBe(2);
    expect(run("log(8, cost)")).toBe(3);
    expect(run("max(score, speed) - min(score, speed)")).toBe(40);
    expect(run("sqrt(abs(-score - 4))")).toBe(8);
    expect(run("round(pi * cost)")).toBe(6);
  });
  it("leaves a model off when an input is missing or the result is not a number", () => {
    expect(run("score / cost", { score: 60, cost: undefined as unknown as number, time: 1, speed: 1 })).toBeUndefined();
    expect(run("score / (cost - 2)")).toBeUndefined();
    expect(run("log(cost - 2)")).toBeUndefined();
    expect(run("sqrt(0 - score)")).toBeUndefined();
    expect(run("score ^ 9999")).toBeUndefined();
  });
  it("explains what is wrong", () => {
    expect(error("")).toBe("Enter a formula");
    expect(error("score / price2")).toContain('Unknown variable "price2"');
    expect(error("score / price2")).toContain("score, cost, time, speed");
    expect(error("score / (cost")).toBe("Missing )");
    expect(error("score / cost)")).toBe("Unexpected )");
    expect(error("score cost")).toContain("Use * to multiply");
    expect(error("2 (score)")).toContain("Use * to multiply");
    expect(error("score /")).toBe("Formula ends early");
    expect(error("score $ cost")).toBe('Unexpected "$"');
    expect(error("sin(score)")).toContain('Unknown function "sin"');
    expect(error("sqrt(score, cost)")).toBe("sqrt() takes 1 value");
    expect(error("pow(score)")).toBe("pow() takes 2 values");
    expect(error("1 + 2")).toContain("Use at least one variable");
    expect(error("score" + " + 1".repeat(60))).toContain("under 200 characters");
    expect(error("(".repeat(60) + "score" + ")".repeat(60))).toBe("Formula is nested too deeply");
  });
  it("reports the variables a formula uses", () => {
    const f = compileFormula("score / cost + Score", KNOWN);
    expect(f.ok && f.uses).toEqual(["score", "cost"]);
  });
});
