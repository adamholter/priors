import { describe, expect, it } from "vitest";
import { THEME_CHOICES, presetOf, resolveAccent, resolvePreset } from "./page-presets";

describe("page themes", () => {
  it("keeps legacy pages: Bone follows dark mode into Night, classic presets never switch", () => {
    expect(resolvePreset(undefined, true).id).toBe("night");
    expect(resolvePreset({ preset: "bone" }, false).id).toBe("bone");
    expect(resolvePreset({ preset: "sand" }, true).id).toBe("sand");
    expect(presetOf({ surface: "white" }).id).toBe("paper");
  });
  it("paired themes follow the visitor unless the owner locks the mode", () => {
    expect(resolvePreset({ preset: "aa" }, true).id).toBe("aa-dark");
    expect(resolvePreset({ preset: "slop" }, false).id).toBe("slop");
    expect(resolvePreset({ preset: "slop-light", mode: "fixed" }, false).id).toBe("slop");
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
