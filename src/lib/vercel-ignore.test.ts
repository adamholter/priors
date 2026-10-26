import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const { ignoreCommand } = JSON.parse(readFileSync("vercel.json", "utf8")) as { ignoreCommand: string };
const run = (previous: string | undefined) => spawnSync("sh", ["-c", ignoreCommand], {
  env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...(previous ? { VERCEL_GIT_PREVIOUS_SHA: previous } : {}) }, encoding: "utf8",
});

// Vercel reads exit 0 as "skip the build", 1 as "build", and anything else as a failed deploy.
describe("vercel ignoreCommand", () => {
  it("builds (exit 1, not a failed deploy) when the previous deploy's commit is missing from the shallow clone", () => {
    expect(run("84e2c70265f0468bc198609ede5985007188316a").status).toBe(1);
  });
  it("builds when there is no previous deploy", () => {
    expect(run(undefined).status).toBe(1);
  });
  it("skips when nothing but data changed since the previous commit", () => {
    const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    expect(run(head).status).toBe(0);
  });
});
