import { describe, expect, it } from "vitest";
import type { Model } from "./types";
import { fillReleaseDates, mistralSuffixDate, openRouterDates } from "./release-dates";

const m = (id: string, labId: string, releaseDate?: string): Model => ({ id, name: id, labId, kind: "llm", reasoning: false, aliases: [], releaseDate });

describe("release dates", () => {
  it("reads Mistral YYMM suffixes and ignores other labs", () => {
    expect(mistralSuffixDate(m("devstral-2512", "mistral"))).toBe("2025-12-01");
    expect(mistralSuffixDate(m("foo-9913", "mistral"))).toBeUndefined();
    expect(mistralSuffixDate(m("qwen-2507", "alibaba"))).toBeUndefined();
  });
  it("prefers source dates, then overrides, then OpenRouter, then suffix", () => {
    const models = [m("gpt-4.0613", "openai"), m("kimi-k9", "moonshot"), m("magistral-small-2509", "mistral"), m("has-date", "openai", "2026-01-01"), m("nothing", "openai")];
    const r = fillReleaseDates(models, new Map([["kimi-k9", "2026-05-05"], ["has-date", "2020-01-01"]]));
    expect(models.map((x) => x.releaseDate)).toEqual(["2023-06-13", "2026-05-05", "2025-09-01", "2026-01-01", undefined]);
    expect(r.stillMissing).toEqual(["nothing"]);
  });
  it("uses the earliest OpenRouter listing and skips bogus timestamps", () => {
    const d = openRouterDates([{ id: "moonshotai/kimi-k2.7", name: "MoonshotAI: Kimi K2.7", created: 1790000000 }, { id: "moonshotai/kimi-k2.7:free", created: 1780000000 }, { id: "x/y", created: 5 }]);
    expect(d.get("kimi-k2.7")).toBe("2026-05-28");
  });
});
