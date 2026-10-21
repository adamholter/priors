import { afterEach, expect, it, vi } from "vitest";
import config from "./next.config";

afterEach(() => vi.unstubAllEnvs());
it.each(["VERCEL", "PRIORS_CLOUDFLARE"])("keeps intro cards on data-live when %s is enabled", async key => {
  vi.stubEnv("VERCEL", ""); vi.stubEnv("PRIORS_CLOUDFLARE", ""); vi.stubEnv(key, "1");
  expect(await config.rewrites!()).toMatchObject({ beforeFiles: [{ source: "/intro/:file([a-z0-9-]+\\.png)", destination: "https://raw.githubusercontent.com/adamholter/priors/data-live/public/intro/:file" }] });
  expect(config.skipTrailingSlashRedirect).toBe(true);
});
