import { describe, expect, it } from "vitest";
import type { Benchmark } from "@/data/types";
import { resolveBenchmark } from "./benchmark-slug";

const b = (id: string, name: string, extra: Partial<Benchmark> = {}) => ({ id, name, sourceId: "s", url: "", description: "", unit: "percent", higherIsBetter: true, category: "coding", ...extra }) as unknown as Benchmark;
const list = [
  b("frontiercode-1.1-main", "FrontierCode 1.1 Main", { shortName: "FrontierCode 1.1" }),
  b("frontiercode-1.1-extended", "FrontierCode 1.1 Extended", { variantOf: "frontiercode-1.1-main" }),
  b("frontiercode-2.0-main", "FrontierCode 2.0", { shortName: "FrontierCode", versionPolicy: { kind: "fresh", supersedes: "frontiercode-1.1-main" } }),
  b("aa-gpqa-diamond", "GPQA Diamond"),
];

describe("resolveBenchmark", () => {
  it("takes an exact id as canonical", () => {
    expect(resolveBenchmark(list, "frontiercode-2.0-main")).toMatchObject({ canonical: true, benchmark: { id: "frontiercode-2.0-main" } });
  });
  it("reads how people say it: punctuation and spacing don't matter", () => {
    expect(resolveBenchmark(list, "frontier-code-2")?.benchmark.id).toBe("frontiercode-2.0-main");
    expect(resolveBenchmark(list, "Frontier_Code_2.0")?.benchmark.id).toBe("frontiercode-2.0-main");
    expect(resolveBenchmark(list, "gpqa-diamond")?.benchmark.id).toBe("aa-gpqa-diamond");
  });
  it("prefers the current version when a name fits several", () => {
    expect(resolveBenchmark(list, "frontiercode")?.benchmark.id).toBe("frontiercode-2.0-main");
    expect(resolveBenchmark(list, "frontier-code-1.1")?.benchmark.id).toBe("frontiercode-1.1-main");
  });
  it("returns nothing for an unknown address", () => {
    expect(resolveBenchmark(list, "nope")).toBeUndefined();
    expect(resolveBenchmark(list, "--")).toBeUndefined();
  });
});
