import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goldenHistories } from "../engine/golden-cases";
import { columnsOf } from "../data/columns";
import type { Snapshot } from "../data/types";
import type { HistoryData } from "./history-frames";

const FIXTURES = path.resolve("src/engine/fixtures");
const expected = JSON.parse(readFileSync(path.join(FIXTURES, "expected.json"), "utf8")) as { history: Record<string, string> };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("history", () => {
  let dir: string, snaps: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "priors-history-"));
    snaps = path.join(dir, "data/snapshots");
    mkdirSync(snaps, { recursive: true });
    for (const f of readdirSync(FIXTURES)) if (f.endsWith(".json.gz")) cpSync(path.join(FIXTURES, f), path.join(snaps, f));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
    vi.resetModules();
  });
  afterEach(() => { vi.restoreAllMocks(); rmSync(dir, { recursive: true, force: true }); });

  const modules = async () => {
    const [{ computeHistory }, load, archive, engine] = await Promise.all([import("./history"), import("../data/load"), import("./history-archive"), import("../engine")]);
    return { computeHistory, load, archive, engine };
  };
  const dates = () => readdirSync(snaps).map((f) => f.match(/^(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]).filter((d): d is string => !!d).sort();
  const writeArchive = async (only: string[]) => {
    const { archive, load } = await modules();
    writeFileSync(path.join(snaps, archive.HISTORY_ARCHIVE), await archive.encodeHistoryArchive(only, (date) => load.readSnapshot(date)));
    vi.resetModules();
  };
  const holdsGoldens = async () => {
    const { computeHistory, load, engine } = await modules();
    const live = (await load.loadSnapshot())!, out: Record<string, HistoryData> = {};
    for (const h of goldenHistories(live, engine.defaultConfig(live))) {
      out[h.id] = await computeHistory(h.config, h.mode);
      expect(sha(JSON.stringify(out[h.id])), h.id).toBe(expected.history[h.id]);
    }
    return out;
  };

  it("without an archive, from the dated snapshots", async () => { await holdsGoldens(); });
  it("from the archive, without opening a dated snapshot", async () => {
    await writeArchive(dates());
    const { load } = await modules();
    expect((await load.loadHistoryArchive())?.dates).toEqual(dates());
    for (const f of dates()) if (f !== "2026-10-31") rmSync(path.join(snaps, `${f}.json.gz`));
    vi.resetModules();
    await holdsGoldens();
  });
  it("an archive missing a date reads that date's snapshot", async () => { await writeArchive(dates().slice(0, 1)); await holdsGoldens(); });
  it("a damaged or newer archive is the same as none", async () => {
    writeFileSync(path.join(snaps, "history.bin.gz"), "not an archive");
    await holdsGoldens();
  });
  it("walks backward as well as forward", async () => {
    await writeArchive(dates());
    const { load, engine } = await modules();
    const archive = (await load.loadHistoryArchive())!, walk = archive.walk(new Map());
    const live = (await load.loadSnapshot())!, config = engine.defaultConfig(live);
    const score = (date: string) => JSON.stringify(engine.rankScores(walk.frame(date)!.columns, { ...config, variants: "all" }).map((r) => [r.variant.id, r.score]));
    const forward = archive.dates.map(score), backward = [...archive.dates].reverse().map(score).reverse();
    expect(backward).toEqual(forward);
    expect(walk.frame("1999-01-01")).toBeUndefined();
  });
  it("a frame counts what the snapshot counts", async () => {
    await writeArchive(dates());
    const { load } = await modules();
    const walk = (await load.loadHistoryArchive())!.walk(new Map());
    for (const date of dates()) {
      const snap: Snapshot = (await load.readSnapshot(date))!, a = columnsOf(snap), b = walk.frame(date)!.columns;
      for (const id of a.benchIds) expect(b.counted[b.benchIndex.get(id)!], `${date} ${id}`).toBe(a.counted[a.benchIndex.get(id)!]);
    }
  });
});
