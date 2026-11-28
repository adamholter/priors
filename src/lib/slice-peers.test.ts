import { describe, expect, it } from "vitest";
import { loadSnapshot } from "@/data/load";
import { benchmarkRelatives } from "./benchmark-metrics";
import { slicePeers } from "./slice-peers";

describe("slicePeers", () => {
  it("ranks every sibling board once: top five best first, one per model, the same answer on the next call", async () => {
    const snapshot = (await loadSnapshot())!;
    const board = snapshot.benchmarks.map((b) => benchmarkRelatives(snapshot, b)).find((r) => r.family.length > 1 || r.versions.length > 1)!;
    expect(board).toBeDefined();
    const peers = slicePeers(snapshot, board), ids = [...board.family, ...board.versions].map((x) => x.id);
    const named = Object.keys(peers);
    expect(named.length).toBeGreaterThan(0);
    for (const id of named) {
      expect(ids).toContain(id);
      const { n, top } = peers[id];
      expect(top.length).toBeLessThanOrEqual(5);
      expect(n).toBeGreaterThanOrEqual(top.length);
      expect(new Set(top.map((t) => t.id)).size).toBe(top.length);
      const higher = snapshot.benchmarks.find((b) => b.id === id)!.higherIsBetter;
      for (let i = 1; i < top.length; i++) expect(higher ? top[i - 1].raw >= top[i].raw : top[i - 1].raw <= top[i].raw).toBe(true);
    }
    expect(slicePeers(snapshot, board)[named[0]]).toBe(peers[named[0]]);
  });

  it("names nothing for a board it does not know", async () => {
    const snapshot = (await loadSnapshot())!;
    expect(slicePeers(snapshot, { family: [{ id: "no-such-board", label: "x" }], versions: [] })).toEqual({});
  });
});
