import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageTabs } from "./PageEdit";

const tabs = (note?: string) => renderToStaticMarkup(<PageTabs indices={[{ id: "a", name: "Artificial Analysis" }, { id: "b", name: "Custom" }]} activeId="b" accent="#000" editing={false} note={note} onSelect={() => {}} onRename={() => {}} onMove={() => {}} onRemove={() => {}} />);

describe("the note under a page's index tabs", () => {
  // It was the tabs' next sibling, and the tabs pull the next item up 16px. On a theme with no gap between sections (Slop)
  // that drew "Fitted from Ignacio's comparisons." up through the tab line.
  it("sits inside the tabs block, after the tab line", () => {
    const html = tabs("Fitted from Ignacio's comparisons.");
    expect(html).toMatch(/^<div class="page-tabs\s+has-note">/);
    expect(html.indexOf("page-tabs-note")).toBeGreaterThan(html.indexOf("page-tabs-list"));
    expect(html).toMatch(/<p class="cap page-tabs-note">Fitted from Ignacio&#x27;s comparisons\.<\/p><\/div>$/);
  });
  it("with a note, the block is not pulled up; without one it still is", () => {
    expect(tabs()).not.toContain("has-note");
    const css = readFileSync(path.join(process.cwd(), "src/components/page/page-themes.css"), "utf8");
    expect(css).toMatch(/\.page-tabs \{[^}]*margin-bottom: -16px/);
    expect(css).toMatch(/\.page-tabs\.has-note \{ margin-bottom: 0; \}|\.page-tabs\.is-editing, \.page-tabs\.has-note \{ margin-bottom: 0; \}/);
  });
});
