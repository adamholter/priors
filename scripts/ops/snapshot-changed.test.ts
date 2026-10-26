import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../../src/data/types";
import { snapshotChanged } from "./snapshot-changed";

const fixture = (): Snapshot => ({
  version: 1, date: "2026-10-04", generatedAt: "2026-10-04T00:00:00Z",
  labs: [{ id: "lab", name: "Lab", color: "blue" }],
  models: [{ id: "model", name: "Model", labId: "lab", releaseDate: "2026-09-01", kind: "llm", reasoning: false, aliases: [] }],
  variants: [{ id: "model@default", modelId: "model", effort: "default" }],
  benchmarks: [{ id: "bench", name: "Bench", sourceId: "source", url: "https://example.com", description: "Benchmark", unit: "percent", higherIsBetter: true, category: "coding" }],
  observations: [{ benchmarkId: "bench", variantId: "model@default", value: 50, observedAt: "2026-10-04T00:00:00Z", sourceUrl: "https://example.com" }],
  sources: [{ sourceId: "source", status: "ok", fetchedAt: "2026-10-04T00:00:00Z", rowCount: 1, unknownLabels: [], rawPath: "data/raw/2026-10-04/source" }],
  series: [],
});

describe("scheduled snapshot change gate", () => {
  it("ignores only refresh metadata, including a harmless day rollover", () => {
    const next = fixture();
    next.date = "2026-10-05";
    next.generatedAt = next.sources[0].fetchedAt = next.observations[0].observedAt = "2026-10-05T02:00:00Z";
    next.sources[0].rawPath = "data/raw/2026-10-05/source";
    expect(snapshotChanged(fixture(), next)).toBe(false);
  });
  it.each(["labs", "models", "variants", "benchmarks", "observations", "sources"] as const)("detects %s additions and removals", (key) => {
    const removed = fixture();
    removed[key] = [];
    expect(snapshotChanged(fixture(), removed)).toBe(true);
    expect(snapshotChanged(removed, fixture())).toBe(true);
  });
  it("preserves all score, model, benchmark and source data", () => {
    const changes: ((s: Snapshot) => void)[] = [
      (s) => { s.observations[0].value += 1; },
      (s) => { s.observations[0].details = { fetchedAt: "publisher-data" }; },
      (s) => { s.models[0].releaseDate = "2026-09-02"; },
      (s) => { s.benchmarks[0].lastUpdated = "2026-10-04"; },
      (s) => { s.sources[0].status = "failed"; s.sources[0].error = "outage"; },
      (s) => { s.sources[0].unknownLabels.push("New Model"); },
      (s) => { s.series.push({ benchmarkId: "bench", variantId: "model@default", x: [1], y: [50], xLabel: "day", yLabel: "score", sourceUrl: "https://example.com" }); },
      (s) => { s.estimates = [{ benchmarkId: "bench", variantId: "model@default", value: 52, estimateKind: "scaled", evidence: ["paired"] }]; },
    ];
    for (const change of changes) {
      const next = fixture(); change(next);
      expect(snapshotChanged(fixture(), next)).toBe(true);
    }
  });
  it("publishes a date rollover that changes default ranking eligibility", () => {
    const previous = fixture(); previous.models[0].releaseDate = "2026-04-04";
    const next = structuredClone(previous); next.date = "2026-10-05";
    expect(snapshotChanged(previous, next)).toBe(true);
  });
  it("CLI compares to Git HEAD, detects first snapshots and fails on invalid input", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "priors-gate-"));
    const file = path.join(cwd, "data/snapshots/latest.json.gz");
    const cli = path.resolve("scripts/ops/snapshot-changed.ts");
    const run = () => spawnSync(process.execPath, ["--import", path.resolve("node_modules/tsx/dist/loader.mjs"), cli], { cwd, encoding: "utf8" }).status;
    try {
      execFileSync("git", ["init", "-q"], { cwd });
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "--allow-empty", "-qm", "init"], { cwd });
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, gzipSync(JSON.stringify(fixture())));
      expect(run()).toBe(10);
      execFileSync("git", ["add", "."], { cwd });
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "snapshot"], { cwd });
      const next = fixture(); next.generatedAt = "2026-10-04T02:00:00Z";
      writeFileSync(file, gzipSync(JSON.stringify(next)));
      expect(run()).toBe(0);
      next.observations[0].value++;
      writeFileSync(file, gzipSync(JSON.stringify(next)));
      expect(run()).toBe(10);
      expect(run()).toBe(10); // Compare to HEAD, never the last local refresh.
      // Published snapshots can exceed execFileSync's default 1 MiB buffer.
      next.observations[0].details = { payload: randomBytes(1500000).toString("base64") };
      writeFileSync(file, gzipSync(JSON.stringify(next)));
      execFileSync("git", ["add", "."], { cwd });
      execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "large snapshot"], { cwd });
      expect(run()).toBe(0);
      writeFileSync(file, "invalid gzip");
      expect(run()).toBe(1);
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
  it("CLI compares to the ref named by SNAPSHOT_BASELINE_REF when given", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "priors-gate-ref-"));
    const file = path.join(cwd, "data/snapshots/latest.json.gz");
    const cli = path.resolve("scripts/ops/snapshot-changed.ts");
    const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", ...args], { cwd, encoding: "utf8" });
    const run = (ref?: string) => spawnSync(process.execPath, ["--import", path.resolve("node_modules/tsx/dist/loader.mjs"), cli], { cwd, encoding: "utf8", env: { ...process.env, SNAPSHOT_BASELINE_REF: ref ?? "" } }).status;
    try {
      git("init", "-q", "-b", "main"); mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, gzipSync(JSON.stringify(fixture()))); git("add", "."); git("commit", "-qm", "main");
      const live = fixture(); live.observations[0].value = 77;
      git("checkout", "-q", "-b", "live"); writeFileSync(file, gzipSync(JSON.stringify(live))); git("commit", "-qam", "live"); git("checkout", "-q", "main");
      writeFileSync(file, gzipSync(JSON.stringify(live)));
      expect(run()).toBe(10); // against main the new value is a change
      expect(run("live")).toBe(0); // against what is live it is not
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
  it("scheduled shell skips timestamp-only refreshes and publishes meaningful data to the live branch without touching main or staged app edits", () => {
    const cwd = mkdtempSync(path.join(tmpdir(), "priors-schedule-"));
    const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" });
    try {
      git("init", "-q"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.com");
      for (const dir of ["scripts/ops", "data/snapshots", "public/intro"]) mkdirSync(path.join(cwd, dir), { recursive: true });
      const file = path.join(cwd, "data/snapshots/latest.json.gz");
      writeFileSync(file, gzipSync(JSON.stringify(fixture())));
      writeFileSync(path.join(cwd, "public/intro/test.png"), "fixture");
      writeFileSync(path.join(cwd, "scripts/ops/daily-scrape.sh"), readFileSync("scripts/ops/daily-scrape.sh"));
      git("add", "."); git("commit", "-qm", "initial");
      git("remote", "add", "origin", path.join(cwd, "no-such-origin.git"));
      writeFileSync(path.join(cwd, "app-edit.txt"), "user edit"); git("add", "app-edit.txt");
      const next = fixture(); next.generatedAt = "refresh";
      writeFileSync(file, gzipSync(JSON.stringify(next)));
      // Stub only network scrapers/renderers and the push. Run the real scheduled
      // shell, real change CLI and real Git staging/commit in an isolated repo.
      const command = `
        npx() { if [[ "$*" == "tsx scripts/ops/snapshot-changed.ts" ]]; then "$GATE_NODE" --import "$GATE_LOADER" "$GATE_CLI"; fi; }
        npm() { return 0; }
        git() { if [[ "$1" == "push" ]]; then echo push >> "$PUSH_LOG"; else command git "$@"; fi; }
        osascript() { return 0; }
        export -f npx npm git osascript
        bash scripts/ops/daily-scrape.sh $SCRAPE_ARGS
      `;
      // --synced is the scrape itself; the step before it resets the checkout to origin/main.
      const run = (args = "--synced") => spawnSync("bash", ["-c", command], { cwd, encoding: "utf8", env: {
        SCRAPE_ARGS: args,
        ...process.env, GATE_NODE: process.execPath, GATE_LOADER: path.resolve("node_modules/tsx/dist/loader.mjs"),
        GATE_CLI: path.resolve("scripts/ops/snapshot-changed.ts"), PUSH_LOG: path.join(cwd, "push.log"),
      } });
      const initial = git("rev-parse", "HEAD");
      // Outside the marked scrape checkout the job refuses before touching anything.
      expect(run("").status).toBe(1);
      expect(git("rev-parse", "HEAD")).toBe(initial);
      expect(git("diff", "--cached", "--name-only")).toBe("app-edit.txt\n");
      const noop = run();
      expect(noop.status, noop.stderr).toBe(0);
      expect(git("rev-parse", "HEAD")).toBe(initial);
      next.observations[0].value++;
      writeFileSync(file, gzipSync(JSON.stringify(next)));
      const update = run();
      expect(update.status, update.stderr).toBe(0);
      // One forced push of the live branch; main gets no commit, and the staged edit is untouched.
      expect(readFileSync(path.join(cwd, "push.log"), "utf8")).toBe("push\n");
      expect(git("rev-parse", "HEAD")).toBe(initial);
      expect(git("diff", "--cached", "--name-only")).toBe("app-edit.txt\n");
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  });
});
