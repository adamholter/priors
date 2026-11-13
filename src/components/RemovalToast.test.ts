import { describe, expect, it } from "vitest";
import { removedBenchmarks } from "./RemovalToast";

describe("removedBenchmarks", () => {
  it("lists benchmarks that had weight and now have none", () => {
    expect(removedBenchmarks({ a: 10, b: 5, c: 0 }, { a: 10, b: 0 })).toEqual(["b"]);
    expect(removedBenchmarks({ a: 10, b: 5 }, {})).toEqual(["a", "b"]);
    expect(removedBenchmarks({ a: 10 }, { a: 3, d: 4 })).toEqual([]);
  });
});
