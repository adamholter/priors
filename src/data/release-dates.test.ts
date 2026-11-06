import { describe, expect, it } from "vitest";
import type { Model } from "./types";
import { applyDateHint, fillReleaseDates, mistralSuffixDate, openRouterDates } from "./release-dates";

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
  it("a pinned date beats a source's date", () => {
    // AA dates Mistral Large 4 to its open weights (Oct 29); it was public on the API from Oct 6.
    const models = [{ id: "mistral-large-4", name: "Mistral Large 4", labId: "mistral", kind: "llm", reasoning: true, aliases: [], releaseDate: "2026-10-29" }] as Model[];
    fillReleaseDates(models, new Map());
    expect(models[0].releaseDate).toBe("2026-10-06");
  });
  it("a source's own record for the model beats an earlier leaderboard row's date", () => {
    // Boggs (read first) dated "o1 (medium)" to Sept 12 2024, o1-preview's date; AA's record for o1 says Dec 5.
    const o1 = { id: "o1", releaseDate: undefined as string | undefined }, dated = new Set<string>();
    applyDateHint(o1, "2024-09-12", false, dated);
    applyDateHint(o1, "2024-12-05", true, dated);
    applyDateHint(o1, "2024-12-17", false, dated);
    applyDateHint(o1, "2025-01-01", true, dated);
    expect(o1.releaseDate).toBe("2024-12-05");
  });
});
