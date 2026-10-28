import { describe, expect, it } from "vitest";
import { shareStrings } from "./share-strings";
import type { Snapshot } from "./types";

describe("shareStrings", () => {
  it("keeps every value as it was", () => {
    const obs = [
      { benchmarkId: "a", variantId: "m@high", value: 1, observedAt: "2026-10-28T00:00:00Z", sourceUrl: "https://a.example", harness: "codex" },
      { benchmarkId: "a", variantId: "n@max", value: 2, observedAt: "2026-10-28T00:00:00Z", sourceUrl: "https://a.example" },
    ];
    const s = { observations: JSON.parse(JSON.stringify(obs)), series: [] } as unknown as Snapshot;
    expect(shareStrings(s).observations).toEqual(obs);
  });
});
