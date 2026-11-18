import { describe, expect, it } from "vitest";
import type { Snapshot } from "@/data/types";
import { aaTaskMetrics } from "./aa-task-metrics";
import { parseReport, senderAddress } from "./extension-feedback";

function snap(n: number): Snapshot {
  const ids = Array.from({ length: n }, (_, i) => `m${i}`);
  return {
    version: 1, date: "2026-11-18", generatedAt: "now", labs: [], models: ids.map((id) => ({ id, name: id, labId: "x" })), series: [], sources: [],
    variants: ids.map((id) => ({ id: `${id}@high`, modelId: id, effort: "high", sourceModel: { url: `https://artificialanalysis.ai/models/${id}-high` } })),
    benchmarks: [{ id: "deepswe-1.1", name: "DeepSWE" }],
    observations: ids.map((id, i) => ({ benchmarkId: "deepswe-1.1", variantId: `${id}@high`, value: 50, costUsd: i + 1, durationSec: 60, observedAt: "", sourceUrl: "https://example.com" })),
  } as unknown as Snapshot;
}

describe("AA Plus task metrics", () => {
  it("gives each source's cost and time by Artificial Analysis slug", () => {
    const [source] = aaTaskMetrics(snap(6)).sources;
    expect(source.id).toBe("deepswe-1.1");
    expect(source.cost?.models["m1-high"]).toBe(2);
    expect(source.time?.models["m0-high"]).toBe(60);
    expect(source.cost?.per).toBe("task run");
  });
  it("leaves out a source with too few models to chart", () => expect(aaTaskMetrics(snap(4)).sources).toEqual([]));
});

describe("AA Plus reports", () => {
  it("takes a bug report with its details and browser id", () => {
    const r = parseReport({ kind: "bug", text: " The plan picker does nothing ", contact: "me@example.com", url: "https://artificialanalysis.ai/", context: "AA Plus 0.5.0", client: "abcd1234" });
    expect(r).toEqual({ ok: true, client: "abcd1234", value: { kind: "bug", text: "The plan picker does nothing", contact: "me@example.com", url: "https://artificialanalysis.ai/", context: "AA Plus 0.5.0" } });
  });
  it("reads the sender's address only from the header the host writes", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(senderAddress(h({ "x-vercel-forwarded-for": "203.0.113.9", "x-real-ip": "1.1.1.1" }), false)).toBe("203.0.113.9");
    expect(senderAddress(h({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "1.1.1.1" }), false)).toBeNull();
    expect(senderAddress(h({ "cf-connecting-ip": "2001:db8::1", "x-vercel-forwarded-for": "1.1.1.1" }), true)).toBe("2001:db8::1");
    expect(senderAddress(h({ "x-vercel-forwarded-for": "not an address" }), false)).toBeNull();
  });
  it("refuses what could never be stored", () => {
    expect(parseReport({ kind: "benchmark", text: "x" }).ok).toBe(false);
    expect(parseReport({ kind: "bug", text: "  " }).ok).toBe(false);
    expect(parseReport({ kind: "bug", text: "x" }, [{ name: "a.pdf", type: "application/pdf", size: 10 }]).ok).toBe(false);
    expect(parseReport({ kind: "bug", text: "x" }, [{ name: "a.png", type: "image/png", size: 5 * 1024 * 1024 }]).ok).toBe(false);
  });
});
