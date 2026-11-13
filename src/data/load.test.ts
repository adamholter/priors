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

describe("data-live pointer", () => {
  const SHA_A = "a".repeat(40), SHA_B = "b".repeat(40);
  beforeEach(() => { vi.stubEnv("SNAPSHOT_BASE_URL", undefined); vi.stubEnv("VERCEL", "1"); vi.stubEnv("EDGE_CONFIG", "https://edge-config.vercel.com/ecfg_test?token=t0k"); });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
  const fetcher = (pointer: () => unknown) => vi.fn(async (url: string, _init?: RequestInit) => (url.includes("edge-config") ? Response.json(pointer()) : new Response(latest)));

  it("reads files at the commit the pointer names, and again only when it moves", async () => {
    let sha = SHA_A;
    const fetchMock = fetcher(() => ({ sha, checked: new Date().toISOString() }));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot, resetLiveCommit } = await fresh();
    const a = await loadSnapshot();
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain(`https://raw.githubusercontent.com/adamholter/priors/${SHA_A}/data/snapshots/latest.json.gz`);
    expect((fetchMock.mock.calls.find((c) => String(c[0]).includes("edge-config"))?.[1] as RequestInit).headers).toEqual({ authorization: "Bearer t0k" });
    resetLiveCommit();
    expect(await loadSnapshot()).toBe(a); // same commit: no new file read
    expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("raw.githubusercontent"))).toHaveLength(1);
    sha = SHA_B; resetLiveCommit();
    await loadSnapshot();
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain(`https://raw.githubusercontent.com/adamholter/priors/${SHA_B}/data/snapshots/latest.json.gz`);
  });

  it("falls back to the branch when the pointer has not been confirmed for a long time", async () => {
    const fetchMock = fetcher(() => ({ sha: SHA_A, checked: new Date(Date.now() - 3 * 3_600_000).toISOString() }));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    await loadSnapshot();
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain("https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots/latest.json.gz");
  });

  it("falls back to the branch when the pointer cannot be read", async () => {
    const fetchMock = vi.fn(async (url: string) => (url.includes("edge-config") ? new Response("no", { status: 401 }) : new Response(latest)));
    vi.stubGlobal("fetch", fetchMock);
    const { loadSnapshot } = await fresh();
    expect((await loadSnapshot())?.models.length).toBeGreaterThan(100);
    expect(fetchMock.mock.calls.map((c) => c[0])).toContain("https://raw.githubusercontent.com/adamholter/priors/data-live/data/snapshots/latest.json.gz");
  });
});
