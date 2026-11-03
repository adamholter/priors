import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseTopLevel } from "./parse-snapshot";

const bytes = (v: unknown, pad?: number) => new TextEncoder().encode(JSON.stringify(v, null, pad));

describe("parseTopLevel", () => {
  it("equals JSON.parse on the real snapshot", () => {
    const raw = gunzipSync(readFileSync(path.resolve(process.cwd(), "data/snapshots/latest.json.gz")));
    expect(parseTopLevel(raw)).toEqual(JSON.parse(raw.toString("utf8")));
  });

  it.each([
    ["scalars and nesting", { a: 1, b: "x", c: null, d: true, e: { f: [1, { g: "}" }] }, h: -1.5e3 }],
    ["arrays of every kind", { a: [], b: [1, "two", null, [3], { four: 4 }], c: [[]], d: [{}] }],
    ["strings that look like syntax", { "k\"ey": "a,]}\"\\", u: "é 😀 \n", l: ["],[", "\\"] }],
    ["empty", {}],
    ["a top-level array", [1, 2]],
  ])("handles %s, compact and indented", (_name, value) => {
    expect(parseTopLevel(bytes(value))).toEqual(value);
    expect(parseTopLevel(bytes(value, 2))).toEqual(value);
  });

  it("shares repeated observation strings", () => {
    const parsed = parseTopLevel<{ o: { sourceUrl: string }[] }>(bytes({ o: [{ sourceUrl: "https://a" }, { sourceUrl: "https://a" }] }));
    expect(parsed.o[1].sourceUrl).toBe("https://a");
  });

  it("fails on a cut-off file", () => {
    expect(() => parseTopLevel(new TextEncoder().encode('{"a":[1,'))).toThrow();
  });
});
