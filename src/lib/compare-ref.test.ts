import { describe, expect, it } from "vitest";
import { compareUrl, formatRef, pageIndex, pageRef, parsePasted, parseRef } from "./compare-ref";
import type { IndexConfig } from "../engine";

const idx = (id: string, name: string): IndexConfig => ({ id, name, weights: { a: 1 }, required: [], cutoff: 5, estimateMissing: true, variants: "all" });

describe("compare refs", () => {
  it("reads me, handles and tabs", () => {
    expect(parseRef("me")).toEqual({ kind: "me" });
    expect(parseRef("@Adam")).toEqual({ kind: "page", handle: "adam", tab: undefined });
    expect(parseRef("@adam~coding-picks")).toEqual({ kind: "page", handle: "adam", tab: "coding-picks" });
  });
  it("reads an index spelled in the builder codec", () => {
    const r = parseRef("Coding|terminalbench-4:60,deepswe-1.1:40|strict=50");
    expect(r).toMatchObject({ kind: "index", config: { name: "Coding", weights: { "terminalbench-4": 60, "deepswe-1.1": 40 } } });
    expect(parseRef(formatRef(r!))).toMatchObject({ kind: "index", config: { weights: { "terminalbench-4": 60 } } });
  });
  it("reads named presets", () => {
    expect(parseRef("preset:aa")).toEqual({ kind: "preset", id: "aa" });
    expect(formatRef({ kind: "preset", id: "general" })).toBe("preset:general");
    expect(parseRef("preset:nope")).toBeUndefined();
  });
  it("rejects junk", () => {
    for (const v of ["", undefined, "adam", "@", "@bad handle", "x|", "hello world"]) expect(parseRef(v)).toBeUndefined();
  });
  it("writes the main index without a tab", () => {
    const list = [idx("i1", "Main"), idx("i2", "Coding picks")];
    expect(formatRef(pageRef("adam", list, list[0]))).toBe("@adam");
    expect(formatRef(pageRef("adam", list, list[1]))).toBe("@adam~coding-picks");
    expect(pageIndex(list, "coding-picks")).toBe(list[1]);
    expect(pageIndex(list, "gone")).toBe(list[0]);
  });
});

describe("pasted links", () => {
  it("reads page, tab and builder links, and bare handles", () => {
    expect(parsePasted("https://mypriors.com/adam")).toEqual({ kind: "page", handle: "adam", tab: undefined });
    expect(parsePasted("https://mypriors.com/adam?hi=coding-picks&c=cost")).toEqual({ kind: "page", handle: "adam", tab: "coding-picks" });
    expect(parsePasted("https://mypriors.com/builder?i=Mine|aa-omniscience:100")).toMatchObject({ kind: "index", config: { name: "Mine" } });
    expect(parsePasted("tommaso")).toEqual({ kind: "page", handle: "tommaso", tab: undefined });
    expect(parsePasted("@tommaso")).toEqual({ kind: "page", handle: "tommaso", tab: undefined });
  });
  it("does not treat site routes as handles", () => {
    expect(parsePasted("https://mypriors.com/explore")).toBeUndefined();
    expect(parsePasted("https://mypriors.com/")).toBeUndefined();
    expect(parsePasted("not a url!")).toBeUndefined();
  });
});

describe("compareUrl", () => {
  it("writes handles and presets readably and leaves defaults out", () => {
    expect(compareUrl({ kind: "me" }, { kind: "page", handle: "tommaso", tab: "coding-picks" })).toBe("/compare?a=me&b=@tommaso~coding-picks");
    expect(compareUrl({ kind: "preset", id: "aa" }, { kind: "preset", id: "general" }, { top: 10 })).toBe("/compare?a=preset:aa&b=preset:general");
    expect(compareUrl({ kind: "me" }, undefined, { top: 5, same: true })).toBe("/compare?a=me&n=5&same=1");
    expect(compareUrl(undefined, undefined)).toBe("/compare");
  });
  it("round-trips an index spelled in the link", () => {
    const ref = parseRef("Mine|terminalbench-4:60,deepswe-1.1:40")!;
    const url = new URL(compareUrl(ref, { kind: "me" }), "https://x.test");
    expect(parseRef(url.searchParams.get("a"))).toMatchObject({ kind: "index", config: { name: "Mine", weights: { "terminalbench-4": 60 } } });
  });
});
