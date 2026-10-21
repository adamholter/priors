import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("bundles the archive and fonts, and strips local secrets from OpenNext's env defaults", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "priors-cf-assets-"));
  try {
    for (const folder of [".open-next/cloudflare", "data/snapshots", "src/lib/og-fonts", "public/skill"]) mkdirSync(path.join(dir, folder), { recursive: true });
    writeFileSync(path.join(dir, ".open-next/cloudflare/next-env.mjs"), 'export const production = { CLERK_SECRET_KEY: "development-secret" };');
    writeFileSync(path.join(dir, "data/snapshots/2026-10-20.json.gz"), "archive");
    writeFileSync(path.join(dir, "src/lib/og-fonts/Inter-400.ttf"), "font");
    const result = spawnSync(process.execPath, [path.resolve("scripts/ops/cloudflare-assets.mjs")], { cwd: dir, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
    const root = path.join(dir, ".open-next/assets/cdn-cgi/priors");
    expect(readFileSync(path.join(root, "data/snapshots/2026-10-20.json.gz"), "utf8")).toBe("archive");
    expect(JSON.parse(readFileSync(path.join(root, "data/snapshots/dates.json"), "utf8"))).toEqual(["2026-10-20.json.gz"]);
    expect(readFileSync(path.join(root, "src/lib/og-fonts/Inter-400.ttf"), "utf8")).toBe("font");
    expect(readFileSync(path.join(dir, ".open-next/cloudflare/next-env.mjs"), "utf8")).toBe("export const production = {};\nexport const development = {};\nexport const test = {};\n");
  } finally { spawnSync("rm", ["-rf", dir]); }
});
