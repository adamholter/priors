import { describe, expect, it } from "vitest";
import { snapshotVersionChanged } from "./profile-version";

describe("snapshotVersionChanged", () => {
  it("detects a published version change", () => expect(snapshotVersionChanged("old", "new")).toBe(true));
  it("ignores the same or missing version", () => {
    expect(snapshotVersionChanged("same", "same")).toBe(false);
    expect(snapshotVersionChanged("same", undefined)).toBe(false);
    expect(snapshotVersionChanged("same", null)).toBe(false);
  });
});
