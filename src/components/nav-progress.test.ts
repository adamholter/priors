import { describe, expect, it } from "vitest";
import { startsNavigation } from "./nav-progress";

const here = "https://mypriors.com/builder?i=x";
const click = { button: 0 };

describe("startsNavigation", () => {
  it("starts for a plain click to another page", () => {
    expect(startsNavigation({ href: "/explore" }, click, here)).toBe(true);
    expect(startsNavigation({ href: "https://mypriors.com/models/x" }, click, here)).toBe(true);
  });
  it("ignores clicks that open elsewhere", () => {
    expect(startsNavigation({ href: "/explore" }, { button: 0, metaKey: true }, here)).toBe(false);
    expect(startsNavigation({ href: "/explore" }, { button: 1 }, here)).toBe(false);
    expect(startsNavigation({ href: "/explore", target: "_blank" }, click, here)).toBe(false);
    expect(startsNavigation({ href: "https://x.com/a" }, click, here)).toBe(false);
  });
  it("ignores links that stay on the page", () => {
    expect(startsNavigation({ href: "/builder?i=y" }, click, here)).toBe(false);
    expect(startsNavigation({ href: "#cost" }, click, here)).toBe(false);
  });
  it("ignores downloads and non-page paths", () => {
    expect(startsNavigation({ href: "/og?x=1", download: true }, click, here)).toBe(false);
    expect(startsNavigation({ href: "/og?x=1" }, click, here)).toBe(false);
    expect(startsNavigation({ href: "/api/benchmarks" }, click, here)).toBe(false);
  });
  it("does not start for the wordmark on the builder, which comes straight back", () => {
    expect(startsNavigation({ href: "/" }, click, here)).toBe(false);
    expect(startsNavigation({ href: "/" }, click, "https://mypriors.com/explore")).toBe(true);
  });
});
