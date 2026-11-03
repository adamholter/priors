import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Snapshot } from "@/data/types";

const benchmarks = [{ id: "bg-gdp-xlsx", name: "GDP.xlsx" }];
vi.mock("@/data/load", () => ({ loadSnapshot: async () => ({ benchmarks }) as unknown as Snapshot }));
vi.mock("@/lib/og-benchmark", () => ({ renderBenchmarkCard: vi.fn(async () => Buffer.from("card")), renderBenchmarkChart: vi.fn(() => null) }));

const get = async (slug: string, search = "") => (await import("./route")).GET(new Request(`https://x.test/benchmarks/${slug}/opengraph-image${search}`), { params: Promise.resolve({ slug }) });

describe("benchmark card route", () => {
  beforeEach(() => { benchmarks.length = 1; });

  it("sends a near-match address to the benchmark's own card rather than caching that card here", async () => {
    const r = await get("gdpx", "?d=2026-11-02");
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toBe("/benchmarks/bg-gdp-xlsx/opengraph-image?d=2026-11-02");
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("caches the card at the benchmark's own address, including once a new benchmark takes it", async () => {
    expect((await get("bg-gdp-xlsx")).headers.get("cache-control")).toContain("s-maxage");
    benchmarks.push({ id: "gdpx", name: "GDPx" });
    const r = await get("gdpx");
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/png");
  });

  it("is a 404 for an address that means nothing", async () => {
    expect((await get("nope")).status).toBe(404);
  });
});
