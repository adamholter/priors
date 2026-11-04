// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MixPie } from "./MixPie";

const html = (slices: Parameters<typeof MixPie>[0]["slices"]) => renderToStaticMarkup(createElement(MixPie, { slices }));
const hrefs = (s: string) => [...s.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);

describe("MixPie", () => {
  it("links each benchmark's row and slice to its page", () => {
    const out = html([{ id: "a", name: "Alpha", share: 60, href: "/benchmarks/a" }, { id: "b", name: "Beta", share: 40, href: "/benchmarks/b" }]);
    expect(hrefs(out).sort()).toEqual(["/benchmarks/a", "/benchmarks/a", "/benchmarks/b", "/benchmarks/b"]);
  });

  it("keeps a slice out of the tab order, since its row is the same link", () => {
    const out = html([{ id: "a", name: "Alpha", share: 100, href: "/benchmarks/a" }]);
    expect(out.match(/<a [^>]*tabindex="-1"/gi)).toHaveLength(1);
  });

  it("shows an import, which has no page, without a link", () => {
    const out = html([{ id: "mine", name: "Mine", share: 100 }]);
    expect(hrefs(out)).toEqual([]);
    expect(out).toContain("Mine");
  });
});
