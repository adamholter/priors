import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Snapshot } from "../data/types";
import { modelStanding } from "./og-model";

const snapshot = JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString("utf8")) as Snapshot;

describe("modelStanding", () => {
  it("ranks once per loaded snapshot: link-preview metadata and the OG image share the answer", () => {
    const id = snapshot.models.find((m) => m.id === "claude-opus-5.5")?.id ?? snapshot.models[0].id;
    const first = modelStanding(snapshot, id);
    expect(first).not.toBeNull();
    expect(modelStanding(snapshot, id)).toBe(first);
    expect(modelStanding(snapshot, "no-such-model")).toBeNull();
  });
});
