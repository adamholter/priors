import { describe, expect, it } from "vitest";
import { snapshotFileForDate } from "./load";

describe("snapshot date selection", () => {
  it("uses the latest snapshot for malformed dates", () => {
    for (const date of ["bad", "2026-02-30", "20261017", ""]) expect(snapshotFileForDate(date)).toBe("latest.json.gz");
  });
  it("keeps valid dates and an omitted date on the existing paths", () => {
    expect(snapshotFileForDate("2026-10-17")).toBe("2026-10-17.json.gz");
    expect(snapshotFileForDate()).toBe("latest.json.gz");
  });
});
