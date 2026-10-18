import { describe, expect, it } from "vitest";
import { peerNote } from "./peer-note";

const donors = ["a@max", "a@high", "b@max", "c@max", "d@max"].map((variantId, i) => ({ variantId, value: 50, weight: 0.4 - i * 0.05 }));
const name = (id: string) => id.split("@")[0].toUpperCase();
describe("peerNote", () => {
  it("names the range and the distinct heaviest donors", () => {
    expect(peerNote({ estimateKind: "peer", estimateRange: [48.6, 55.2], donors }, name)).toBe("Peer estimate, likely 49 to 55, from A, B, C and 1 more");
  });
  it("says nothing for measured or effort-adjusted values", () => {
    expect(peerNote({ estimateKind: "effort" }, name)).toBeUndefined();
    expect(peerNote({}, name)).toBeUndefined();
  });
});
