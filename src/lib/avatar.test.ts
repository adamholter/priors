import { describe, expect, it } from "vitest";
import { avatarSrc, fitWithin } from "./avatar";

describe("avatarSrc", () => {
  it("asks Clerk's image host for twice the shown size", () => {
    expect(avatarSrc("https://img.clerk.com/abc", 36)).toBe("https://img.clerk.com/abc?width=72&height=72&fit=crop");
  });
  it("leaves every other address alone", () => {
    expect(avatarSrc("https://x.convex.cloud/api/storage/1", 36)).toBe("https://x.convex.cloud/api/storage/1");
    expect(avatarSrc("not a url", 36)).toBe("not a url");
  });
});

describe("fitWithin", () => {
  it("shrinks the longer side to the limit and keeps the shape", () => {
    expect(fitWithin(4000, 2000, 1000)).toEqual({ width: 1000, height: 500 });
    expect(fitWithin(1000, 3000, 600)).toEqual({ width: 200, height: 600 });
  });
  it("never enlarges", () => {
    expect(fitWithin(100, 80, 512)).toEqual({ width: 100, height: 80 });
  });
});
