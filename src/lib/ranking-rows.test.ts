import { describe, expect, it } from "vitest";
import { labTitle, shownScore, tieLabel, tiesOf } from "./ranking-rows";

const row = (id: string, rank: number, text: string) => ({ id, rank, text });

describe("tiesOf", () => {
  it("groups neighbours with the same text and leaves single rows out", () => {
    const t = tiesOf([row("a", 1, "64.8"), row("b", 2, "62.2"), row("c", 3, "62.2"), row("d", 4, "62.2"), row("e", 5, "59.1")]);
    expect([...t.keys()]).toEqual(["b", "c", "d"]);
    expect(t.get("c")).toEqual({ first: 2, last: 4, size: 3, text: "62.2" });
  });
  it("does not join equal text that is not adjacent", () => {
    expect(tiesOf([row("a", 1, "5.0"), row("b", 2, "4.0"), row("c", 3, "5.0")]).size).toBe(0);
  });
  it("handles an empty list", () => {
    expect(tiesOf([]).size).toBe(0);
  });
  it("keeps the first rank of a tie that follows a tied pair", () => {
    const t = tiesOf([row("a", 1, "9"), row("b", 2, "9"), row("c", 3, "8"), row("d", 4, "8")]);
    expect(t.get("a")?.first).toBe(1);
    expect(t.get("d")).toEqual({ first: 3, last: 4, size: 2, text: "8" });
  });
});

describe("tieLabel", () => {
  const tie = { first: 23, last: 24, size: 2, text: "40.0" };
  it("prefixes = on tied rows and shows the plain rank otherwise", () => {
    expect(tieLabel(tie, 24)).toBe("=23");
    expect(tieLabel(undefined, 7)).toBe("7");
  });
  it("drops the = from rank 100 so it fits", () => {
    expect(tieLabel({ ...tie, first: 100 }, 101)).toBe("100");
  });
});

describe("labTitle", () => {
  it("capitalizes a lab the snapshot names by its lowercase id", () => {
    expect(labTitle("microsoft", "microsoft")).toBe("Microsoft");
    expect(labTitle(undefined, "baidu")).toBe("Baidu");
  });
  it("keeps names that already have capitals", () => {
    expect(labTitle("OpenAI", "openai")).toBe("OpenAI");
    expect(labTitle("xAI", "xai")).toBe("xAI");
  });
});

describe("shownScore", () => {
  it("rounds an index score to the one decimal the row shows", () => {
    expect(shownScore(62.24, false)).toBe(62.2);
    expect(shownScore(62.26, false)).toBe(62.3);
  });
  it("leaves a formatted benchmark value alone", () => {
    expect(shownScore(62.2678, true)).toBe(62.2678);
  });
});
