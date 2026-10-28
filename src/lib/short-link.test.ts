import { describe, expect, it } from "vitest";
import { MAX_PATH_BYTES, pathHash, randomSlug, validPath, validSlug } from "../../convex/shortLinkPath";
import { pathToShorten, shortUrl } from "./short-link";

const origin = "https://mypriors.com";
const long = `${origin}/builder?c=cost&i=${"x".repeat(400)}#cost`;

describe("short link slugs", () => {
  it("are seven base62 characters", () => {
    for (let i = 0; i < 200; i++) expect(randomSlug()).toMatch(/^[0-9A-Za-z]{7}$/);
  });
  it("skip biased bytes and keep drawing", () => {
    const calls: number[] = [];
    const slug = randomSlug((n) => { calls.push(n); return new Uint8Array(n).fill(calls.length === 1 ? 255 : 1); });
    expect(slug).toBe("1111111");
    expect(calls.length).toBe(2);
  });
  it("validSlug rejects other shapes", () => {
    expect(validSlug("aB3dE9z")).toBe(true);
    for (const bad of ["", "abc", "aB3dE9z1", "aB3dE9-", "aB3 E9z"]) expect(validSlug(bad)).toBe(false);
  });
});

describe("validPath", () => {
  it("takes same-origin paths with query and hash", () => {
    expect(validPath("/builder?c=cost&i=a%2Cb#cost")).toBe(true);
    expect(validPath("/")).toBe(true);
  });
  it("rejects other origins and control characters", () => {
    for (const bad of ["", "builder", "//evil.com", "/\\evil.com", "https://evil.com/x", "/a\nb", "/a\u0000b"]) expect(validPath(bad)).toBe(false);
  });
  it("caps the size", () => {
    expect(validPath("/" + "a".repeat(MAX_PATH_BYTES - 1))).toBe(true);
    expect(validPath("/" + "a".repeat(MAX_PATH_BYTES))).toBe(false);
  });
});

describe("pathHash", () => {
  it("is stable per path", async () => {
    expect(await pathHash("/a")).toBe(await pathHash("/a"));
    expect(await pathHash("/a")).not.toBe(await pathHash("/b"));
    expect(await pathHash("/a")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("pathToShorten", () => {
  it("returns the path of a long same-origin link", () => {
    expect(pathToShorten(long, origin)).toBe(`/builder?c=cost&i=${"x".repeat(400)}#cost`);
  });
  it("leaves short links alone", () => {
    expect(pathToShorten(`${origin}/builder?c=cost`, origin)).toBeNull();
    expect(pathToShorten("x".repeat(300), origin)).toBeNull();
  });
  it("leaves other origins and junk alone", () => {
    expect(pathToShorten(long.replace(origin, "https://example.com"), origin)).toBeNull();
    expect(pathToShorten("http://[bad" + "x".repeat(400), origin)).toBeNull();
  });
  it("builds the short URL", () => expect(shortUrl(origin, "aB3dE9z")).toBe("https://mypriors.com/s/aB3dE9z"));
});
