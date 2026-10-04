import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { defaultReleasedAfter } from "../../src/engine";
import type { Snapshot } from "../../src/data/types";

// Only these schema-specific fields describe the refresh rather than its data.
// Keep array order (including ranking ties) and every unknown/new data field.
export function snapshotContent(snapshot: Snapshot): string {
  const { date, generatedAt: _generatedAt, ...data } = snapshot;
  void _generatedAt;
  const cutoff = defaultReleasedAfter(date);
  const content = {
    ...data,
    observations: data.observations.map(({ observedAt: _observedAt, ...row }) => { void _observedAt; return row; }),
    sources: data.sources.map(({ fetchedAt: _fetchedAt, rawPath: _rawPath, ...run }) => { void _fetchedAt; void _rawPath; return run; }),
    // Date rollovers matter only when they change the engine's default age gate.
    defaultAgeEligible: data.models.filter((m) => !m.releaseDate || m.releaseDate >= cutoff).map((m) => m.id),
  };
  return JSON.stringify(content, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
    }
    return value;
  });
}

export function snapshotChanged(previous: Snapshot, current: Snapshot): boolean {
  return snapshotContent(previous) !== snapshotContent(current);
}

// Exit 0 = unchanged, 10 = changed, 1 = failure. Never turn a read/parse/Git
// failure into an unchanged decision. Compare with published history, not the
// previous local refresh, so skipped refreshes cannot mask cumulative changes.
if (process.argv[1]?.endsWith("snapshot-changed.ts")) {
  try {
    const file = "data/snapshots/latest.json.gz";
    const decode = (bytes: Buffer): Snapshot => JSON.parse(gunzipSync(bytes).toString("utf8"));
    const current = decode(readFileSync(file));
    const tracked = execFileSync("git", ["ls-tree", "HEAD", "--", file], { encoding: "utf8" });
    const changed = !tracked.trim() || snapshotChanged(decode(execFileSync("git", ["show", `HEAD:${file}`])), current);
    console.log(changed ? "Snapshot data changed; publishing update." : "No new snapshot data; skipping commit and push.");
    process.exitCode = changed ? 10 : 0;
  } catch (error) {
    console.error("Snapshot change check failed:", error);
    process.exitCode = 1;
  }
}
