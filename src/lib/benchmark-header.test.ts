import { describe, expect, it } from "vitest";
import { shortDay, shorten, signedPoints } from "./benchmark-header";

const ECI = "One capability score per model, fitted across many benchmarks so that models tested on different sets can be compared. Claude 3.5 Sonnet is set to 130 and GPT-5 to 150; intervals are 90% credible intervals. It uses each model's best score per benchmark, so a row is the model's best measured setting, not one reasoning effort. From Epoch AI.";
const LISAN = "Word chains: from each of 50 starting words, the model links real words that each differ from the last by one letter (added, removed or swapped), never repeating a word, for as long as it can. Valid steps per chain, summed over the 50 words.";

describe("shorten", () => {
  it("leaves a description that fits alone", () => {
    expect(shorten("Open integer sequences from the OEIS: find the rule behind a sequence and extend it. Share solved. From Epoch AI.", 175)).toBeNull();
  });
  it("stops after a whole sentence, never inside one, when the first sentence fits", () => {
    const c = shorten(ECI, 175)!;
    expect(c.lead).toBe("One capability score per model, fitted across many benchmarks so that models tested on different sets can be compared.");
    expect(c.mid).toBe(false);
    expect(c.lead + c.rest).toBe(ECI);
  });
  it("takes more whole sentences while they fit", () => {
    const c = shorten("113 long tasks solved by a simple agent. Share solved on the first try. The original board, used for models not yet run on v1.1 and kept so older results stay comparable with the newer one.", 120)!;
    expect(c.lead).toBe("113 long tasks solved by a simple agent. Share solved on the first try.");
  });
  it("cuts a very long first sentence at a clause and marks the cut", () => {
    const c = shorten(LISAN, 120)!;
    expect(c.mid).toBe(true);
    expect(c.lead.length).toBeLessThanOrEqual(120);
    expect(c.lead).not.toMatch(/[,;:]$/);
    expect(c.lead).not.toMatch(/\b(the|a|of|by|that|each|from|with)$/i);
    expect(c.lead + c.rest).toBe(LISAN);
  });
  it("does not split on a version number", () => {
    const c = shorten("Runs on v1.1 of the harness. " + "More detail that goes on for a while and then a while more so the whole text is long enough to need a cut. ".repeat(2), 60)!;
    expect(c.lead.startsWith("Runs on v1.1 of the harness.")).toBe(true);
  });
  it("does not cut when only a short tail would be hidden", () => {
    expect(shorten("A single sentence that is only a little longer than the limit allows, ok.", 62)).toBeNull();
  });
});

describe("shortDay", () => {
  it("drops the year when it is the reference year", () => {
    expect(shortDay("2026-11-04", "2026-11-28")).toBe("Nov 4");
  });
  it("keeps the year when it differs", () => {
    expect(shortDay("2025-03-15", "2026-11-28")).toBe("Mar 15, 2025");
  });
  it("reads a timestamp by its date", () => {
    expect(shortDay("2026-01-09T10:00:00Z", "2026-11-28")).toBe("Jan 9");
  });
  it("returns text that is not a date unchanged", () => {
    expect(shortDay("last week", "2026-11-28")).toBe("last week");
    expect(shortDay("2026-13-01", "2026-11-28")).toBe("2026-13-01");
  });
});

describe("signedPoints", () => {
  it("signs with a real minus", () => {
    expect(signedPoints(-25)).toBe("−25");
    expect(signedPoints(15)).toBe("+15");
    expect(signedPoints(0)).toBe("0");
  });
  it("shows a decimal only when there is one", () => {
    expect(signedPoints(-2.5)).toBe("−2.5");
    expect(signedPoints(3)).toBe("+3");
  });
});
