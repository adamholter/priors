import { readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const latest = readFileSync(path.resolve(process.cwd(), "data/snapshots/latest.json.gz"));

async function fresh() {
  vi.resetModules();
  return import("./load");
}

describe("live snapshot source", () => {
  beforeEach(() => { vi.stubEnv("SNAPSHOT_BASE_URL", "https://data.example/snapshots/"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("uses data-live by default on Cloudflare without pretending to be Vercel", async () => {
    vi.stubEnv("SNAPSHOT_BASE_URL", undefined);
    vi.stubEnv("VERCEL", ""); vi.stubEnv("PRIORS_CLOUDFLARE", "1");
    const fetchMock = vi.fn(async () => new Response(latest));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    expect((await loadSnapshot())?.models.length).toBeGreaterThan(100);
    expect(fetchMock).toHaveBeenCalledWith("https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots/latest.json.gz", expect.any(Object));
  });

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

  it("answers for today's mix library from the live latest, so the smart sprint runs in production", async () => {
    const library = { date: "2031-01-02", settingsKey: "x", columns: {}, mixes: {} };
    const fetchMock = vi.fn(async (_url: string) => new Response(gzipSync(JSON.stringify(library))));
    vi.stubGlobal("fetch", fetchMock);
    const { loadMixLibrary } = await fresh();
    expect((await loadMixLibrary("2031-01-02"))?.date).toBe("2031-01-02");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://data.example/snapshots/latest.library.json.gz");
    expect(await loadMixLibrary("2031-01-01")).toBeNull();
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

  it("does not fetch dated files outside the last month", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(latest));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    await loadSnapshot();
    expect(await loadSnapshot("2020-01-01")).toBeNull();
    expect(await loadSnapshot("2999-01-01")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
