import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseCodexLimits } from "./sources/codex-limits";

describe("Codex usage limits", () => {
  it("reads the Plus column of OpenAI's messages-per-five-hours table", () => {
    const rows = parseCodexLimits(readFileSync(new URL("./fixtures/codex-pricing-limits.html", import.meta.url), "utf8"));
    expect(rows).toContainEqual({ model: "GPT-6.1 Terra", low: 35, high: 285 });
    expect(rows).toContainEqual({ model: "GPT-6.1 Sol", low: 15, high: 160 });
    expect(rows.find((r) => r.model === "GPT-6 Luna")).toEqual({ model: "GPT-6 Luna", low: 350, high: 3000 });
  });
  it("ignores tables without a Plus column", () => {
    expect(parseCodexLimits("<table><tr><th>Model</th><th>Pro</th></tr><tr><td>GPT-6 Sol</td><td>1-2</td></tr></table>")).toEqual([]);
  });
});
