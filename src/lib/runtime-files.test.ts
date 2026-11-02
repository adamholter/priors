import { readFile } from "node:fs/promises";
import { afterEach, expect, it, vi } from "vitest";
import { bundledSnapshotDates, readRuntimeFile } from "./runtime-files";

const assets = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: () => ({ env: { ASSETS: assets } }) }));
afterEach(() => { vi.unstubAllEnvs(); assets.fetch.mockReset(); });

it("reads local build inputs without changing Vercel's filesystem path", async () => {
  vi.stubEnv("PRIORS_CLOUDFLARE", "");
  expect(await readRuntimeFile("src/lib/og-fonts/Inter-400.ttf")).toEqual(await readFile("src/lib/og-fonts/Inter-400.ttf"));
  expect(await bundledSnapshotDates()).toContain("2026-10-14");
  expect(assets.fetch).not.toHaveBeenCalled();
});

it("loads Workers fonts and the sorted archive manifest through the private binding", async () => {
  vi.stubEnv("PRIORS_CLOUDFLARE", "1");
  assets.fetch.mockResolvedValueOnce(new Response("font bytes"));
  expect((await readRuntimeFile("src/lib/og-fonts/Inter-400.ttf")).toString()).toBe("font bytes");
  expect(assets.fetch).toHaveBeenCalledWith("https://assets.local/cdn-cgi/priors/src/lib/og-fonts/Inter-400.ttf");
  assets.fetch.mockResolvedValueOnce(Response.json(["latest.json.gz", "2026-10-15.json.gz", "2026-10-14.json.gz", "2026-10-14.library.json.gz"]));
  expect(await bundledSnapshotDates()).toEqual(["2026-10-14", "2026-10-15"]);
});

it("fails explicitly when a Workers archive asset is missing", async () => {
  vi.stubEnv("PRIORS_CLOUDFLARE", "1");
  assets.fetch.mockResolvedValueOnce(new Response("", { status: 404 }));
  await expect(readRuntimeFile("data/snapshots/2026-10-14.json.gz")).rejects.toThrow("Missing bundled file");
});
