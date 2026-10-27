import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseVb2Bundle, splitRunLabel } from "./sources/andonlabs";

const fixture = (name: string) => readFileSync(fileURLToPath(new URL("./fixtures/" + name, import.meta.url)), "utf8");

describe("Vending-Bench 2 bundle", () => {
  it("reads each run's money balance by day and its mean API cost", () => {
    const b = parseVb2Bundle([fixture("andon-vb2-series.js.txt"), fixture("andon-vb2-costs.js.txt")]);
    expect(b.days.length).toBe(365);
    expect(b.runs.map((r) => r.name)).toEqual(expect.arrayContaining(["Claude Fable 5 - High", "GPT-6 Astra", "Claude Opus 5.5"]));
    for (const r of b.runs) expect(r.balance.length).toBe(b.days.length);
    expect(b.runs.find((r) => r.name === "Claude Fable 5 - High")).toMatchObject({ final: 5680.258 });
    expect(b.costs.get("GPT-6 Astra")).toMatchObject({ meanCost: 810.41, runs: 6, outputTokens: 321093 });
  });
  it("splits the effort off a run name", () => {
    expect(splitRunLabel("Claude Fable 5 - High")).toEqual({ label: "Claude Fable 5", effort: "high" });
    expect(splitRunLabel("GPT-6 Astra")).toEqual({ label: "GPT-6 Astra" });
  });
});
