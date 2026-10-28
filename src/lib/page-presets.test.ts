import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cardPalette, cardTheme } from "./og-chart";
import { LIBRARY_CHOICES, PAGE_PRESETS, THEME_CHOICES, pickerThemeOf, presetOf, resolveAccent, resolvePreset, themeById } from "./page-presets";

describe("page themes", () => {
  it("keeps legacy pages: Bone follows dark mode into Night, classic presets never switch", () => {
    expect(resolvePreset(undefined, true).id).toBe("night");
    expect(resolvePreset({ preset: "bone" }, false).id).toBe("bone");
    expect(resolvePreset({ preset: "sand" }, true).id).toBe("sand");
    expect(presetOf({ surface: "white" }).id).toBe("paper");
  });
  it("paired themes follow the visitor unless the owner locks the mode", () => {
    expect(resolvePreset({ preset: "aa" }, true).id).toBe("aa-dark");
    expect(resolvePreset({ preset: "slop" }, false).id).toBe("slop-light");
    expect(resolvePreset({ preset: "slop", mode: "fixed" }, false).id).toBe("slop");
    expect(resolvePreset({ preset: "slop-light", mode: "fixed" }, true).id).toBe("slop-light");
  });
  it("custom accents carry across modes; theme defaults use each mode's own accent", () => {
    const night = resolvePreset({ preset: "bone" }, true);
    expect(resolveAccent({ preset: "bone" }, night)).toBe(night.accent);
    expect(resolveAccent({ preset: "bone", accent: "#2F4FB0" }, night)).toBe(night.accent);
    expect(resolveAccent({ preset: "aa", accent: "#C2410C" }, presetOf({ preset: "aa" }))).toBe("#C2410C");
    expect(resolveAccent({ preset: "aa", accent: "#C2410C" }, presetOf({ preset: "aa-dark" }))).toContain("color-mix");
  });
  it("offers one picker card per theme, every lookalike with lab colors and fonts", () => {
    expect(new Set(THEME_CHOICES.map((t) => t.id)).size).toBe(THEME_CHOICES.length);
    for (const t of THEME_CHOICES.filter((x) => x.family === "aa" || x.family === "slop")) {
      expect(t.labColors?.anthropic).toBeTruthy();
      expect(t.fonts?.sans).toBeTruthy();
    }
  });
});

describe("theme library (Explore themes)", () => {
  const lum = (hex: string) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  it("keeps the default pickers and resolves every library id", () => {
    expect(THEME_CHOICES.map((t) => t.id)).toEqual(["bone", "aa", "slop", "paper", "sand", "graphite", "midnight", "forest"]);
    expect(LIBRARY_CHOICES.length).toBeGreaterThanOrEqual(9);
    for (const t of LIBRARY_CHOICES) {
      expect(THEME_CHOICES.some((c) => c.id === t.id)).toBe(false);
      expect(presetOf({ preset: t.id }).id).toBe(t.id);
      expect(themeById(t.id)).toBe(t);
      if (t.pair) { expect(themeById(t.pair)?.pair).toBe(t.id); expect(themeById(t.pair)?.dark).toBe(!t.dark); expect(resolvePreset({ preset: t.id }, !t.dark).id).toBe(t.pair); expect(pickerThemeOf(t.pair)).toBe(t); }
    }
  });
  it("paints every library theme's cards and charts with its own look", () => {
    for (const t of LIBRARY_CHOICES) {
      expect(cardTheme({ preset: t.id })?.id).toBe(t.id);
      expect(cardPalette({ preset: t.id }).ink).toBe(t.ink);
      if (t.pair) expect(cardTheme({ preset: t.id }, t.dark ? "light" : "dark")?.id).toBe(t.pair);
    }
  });
  it("keeps text readable: ink, secondary ink, grey and accent against the page and the card", () => {
    for (const t of PAGE_PRESETS.filter((p) => p.library)) for (const bg of [t.bg, t.surface ?? t.bg]) {
      expect(contrast(t.ink, bg), `${t.id} ink`).toBeGreaterThanOrEqual(7);
      expect(contrast(t.ink2, bg), `${t.id} ink2`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.grey, bg), `${t.id} grey`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.accent, bg), `${t.id} accent`).toBeGreaterThanOrEqual(4.5);
      expect(contrast("#FFFFFF", t.dark ? t.panelAccent ?? t.accent : t.accent), `${t.id} button`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("every card font file exists", () => {
    for (const f of new Set(PAGE_PRESETS.flatMap((p) => p.cardFonts ?? []))) expect(existsSync(path.join(process.cwd(), "src/lib/og-fonts", f)), f).toBe(true);
  });
});
