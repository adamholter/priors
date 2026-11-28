import { describe, expect, it } from "vitest";
import type { IndexConfig } from "@/engine";
import { openCopyOf, openedFromPage, type PageMixes } from "./page-mixes";
import { pageIndexId } from "./url";

const mix = (id: string, name: string) => ({ id, name, weights: { a: 1 }, required: [] } as unknown as IndexConfig);
const page: PageMixes = { handle: "adam", indices: [mix("i-1", "Coding"), mix("i-2", "Writing")] };

describe("page mixes in the builder", () => {
  it("finds an open copy by its page reference, then by name", () => {
    const opened = openedFromPage([], page, page.indices[0], "k1");
    expect(openCopyOf([{ ...opened, name: "Renamed" }], page, page.indices[0], "k1")?.id).toBe("i-1");
    expect(openCopyOf([mix("x", " writing ")], page, page.indices[1], "k1")?.id).toBe("x");
    expect(openCopyOf([mix("x", "Other")], page, page.indices[1], "k1")).toBeUndefined();
  });
  it("a reference from another tab's key does not count", () => {
    const opened = { ...openedFromPage([], page, page.indices[0], "k1"), name: "Renamed" };
    expect(openCopyOf([opened], page, page.indices[0], "k2")).toBeUndefined();
  });
  it("opens with a page reference that saving resolves back to the page mix, and a fresh id when the id is taken", () => {
    const a = openedFromPage([], page, page.indices[0], "k1");
    expect(a.id).toBe("i-1");
    expect(pageIndexId(a, "adam", "k1")).toBe("i-1");
    const b = openedFromPage([mix("i-1", "Something else")], page, page.indices[0], "k1");
    expect(b.id).not.toBe("i-1");
    expect(pageIndexId(b, "adam", "k1")).toBe("i-1");
    expect(openedFromPage([], page, page.indices[0], null).page).toBeUndefined();
  });
});
