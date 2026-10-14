import { describe, expect, it } from "vitest";
import { takeOn } from "./take";

const name = (id: string) => id.toUpperCase();
describe("takeOn", () => {
  it("names a different #1 and the biggest riser", () => {
    const t = takeOn(["c", "a", "b", "d", "e"], ["a", "b", "d", "e", "c"], name, "the benchmark consensus");
    expect(t.lines[0]).toBe("Your #1 is C. The benchmark consensus picks A.");
    expect(t.hook).toBe("The benchmark consensus picks A.");
    expect(t.lines).toHaveLength(1);
  });
  it("calls out a riser below #1", () => {
    expect(takeOn(["a", "e", "b", "c", "d"], ["a", "b", "c", "d", "e"], name, "your last index").lines).toEqual(["You rank E 3 places higher than your last index does."]);
  });
  it("says so when you agree", () => {
    expect(takeOn(["a", "b", "c", "d"], ["a", "b", "c", "d"], name, "the benchmark consensus").lines).toEqual(["Your top 4 match the benchmark consensus exactly."]);
    expect(takeOn(["a", "c", "b"], ["a", "b", "c"], name, "x").lines).toEqual(["You agree with x on the #1."]);
  });
  it("ignores baseline models outside your lineup", () => {
    expect(takeOn(["a", "b", "c"], ["z", "a", "b", "c"], name, "x").hook).toBe("");
  });
});
