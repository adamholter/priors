import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const latest = readFileSync(path.resolve(process.cwd(), "data/snapshots/latest.json.gz"));

async function fresh() {
  vi.resetModules();
  return import("./load");
}

describe("live snapshot source", () => {
  beforeEach(() => { vi.stubEnv("SNAPSHOT_BASE_URL", "https://data.example/snapshots/"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("reads the latest snapshot from the live base and keeps it for the TTL", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(latest));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    const a = await loadSnapshot();
    const b = await loadSnapshot();
    expect(a?.models.length).toBeGreaterThan(100);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://data.example/snapshots/latest.json.gz");
  });

  it("serves today's dated file from the live latest", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(latest));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    const live = await loadSnapshot();
    expect(await loadSnapshot(live!.date)).toBe(live);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the checkout when the live base is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { loadSnapshot } = await fresh();
    expect((await loadSnapshot())?.models.length).toBeGreaterThan(100);
  });

  it("ignores a live file that does not parse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not gzip")));
    const { loadSnapshot } = await fresh();
    expect((await loadSnapshot())?.models.length).toBeGreaterThan(100);
  });

  it("reads only the checkout when no live base is set", async () => {
    vi.stubEnv("SNAPSHOT_BASE_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    expect(await loadSnapshot()).not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
