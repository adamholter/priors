import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEME_CRITICAL_CSS } from "../lib/theme-critical";

describe("first paint scheme", () => {
  it("the pre-stylesheet background is the dark page color", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const dark = css.match(/:root\[data-theme="dark"\]\s*\{[^}]*--bone:\s*(#[0-9A-Fa-f]{6})/)?.[1];
    expect(dark).toBeTruthy();
    expect(THEME_CRITICAL_CSS.toLowerCase()).toContain(`background:${dark!.toLowerCase()}`);
  });
  it("only applies until the theme script has set data-theme, and follows the system", () => {
    expect(THEME_CRITICAL_CSS).toContain("prefers-color-scheme: dark");
    expect(THEME_CRITICAL_CSS).toContain("html:not([data-theme])");
  });
});
