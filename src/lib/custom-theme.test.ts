import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { EXAMPLE_THEME, THEME_FONT_NAMES, THEME_FONTS, compileTheme, inlinePreset, parseTheme, parseThemeText, signaturePreset, themeId, themePrompt } from "./custom-theme";
import { pickerThemeOf, presetOf, presetStyle, resolvePreset, themeById } from "./page-presets";
import { paletteFor } from "@/components/chart/theme";

const parsed = (v: unknown) => { const r = parseTheme(v); if (!r.ok) throw new Error(r.errors.join("; ")); return r; };

describe("custom themes", () => {
  it("accepts the example theme, which is also what the agent prompt shows", () => {
    const r = parsed(EXAMPLE_THEME);
    expect(r.warnings).toEqual([]);
    expect(themePrompt()).toContain(JSON.stringify(EXAMPLE_THEME, null, 2));
  });

  it("normalizes colors and reads a fenced paste with prose around it", () => {
    const text = `Here you go!\n\`\`\`json\n${JSON.stringify({ ...EXAMPLE_THEME, light: { ...EXAMPLE_THEME.light, bg: "#fff", ink: "#111" } })}\n\`\`\`\nEnjoy.`;
    const r = parseThemeText(text);
    expect(r.ok && r.theme.light?.bg).toBe("#FFFFFF");
    expect(r.ok && r.theme.light?.ink).toBe("#111111");
  });

  it("rejects anything that could inject CSS, with a message that names the field", () => {
    for (const bad of ["red", "rgb(0,0,0)", "var(--ink)", "url(x)", "#12", "#GGGGGG", "#111; background: url(x)", 12]) {
      const r = parseTheme({ ...EXAMPLE_THEME, light: { ...EXAMPLE_THEME.light, accent: bad } });
      expect(r.ok, String(bad)).toBe(false);
      expect(!r.ok && r.errors.join(" ")).toContain('"light.accent"');
    }
    const font = parseTheme({ ...EXAMPLE_THEME, fonts: { sans: "Papyrus'; } body { display:none" } });
    expect(!font.ok && font.errors.join(" ")).toContain("fonts.sans");
    expect(parseTheme({ ...EXAMPLE_THEME, light: { ...EXAMPLE_THEME.light, labs: { "bad id;": "#111111" } } }).ok).toBe(false);
  });

  it("checks modes and readability: a dark light mode, a light dark mode, unreadable text", () => {
    expect(parseTheme({ ...EXAMPLE_THEME, light: { ...EXAMPLE_THEME.light, bg: "#101010" } }).ok).toBe(false);
    expect(parseTheme({ ...EXAMPLE_THEME, dark: { ...EXAMPLE_THEME.dark, bg: "#F0F0F0" } }).ok).toBe(false);
    const r = parseTheme({ ...EXAMPLE_THEME, light: { ...EXAMPLE_THEME.light, ink: "#888888" } });
    expect(!r.ok && r.errors.join(" ")).toMatch(/body text needs at least 4\.5:1/);
  });

  it("requires a name, a format version, at least one mode, and the required colors", () => {
    expect(parseTheme(null).ok).toBe(false);
    expect(parseTheme({ ...EXAMPLE_THEME, priorsTheme: 2 }).ok).toBe(false);
    expect(parseTheme({ ...EXAMPLE_THEME, name: "" }).ok).toBe(false);
    expect(parseTheme({ priorsTheme: 1, name: "x" }).ok).toBe(false);
    const noInk: Record<string, unknown> = { ...EXAMPLE_THEME.light }; delete noInk.ink;
    const r = parseTheme({ ...EXAMPLE_THEME, light: noInk });
    expect(!r.ok && r.errors.join(" ")).toContain('"light.ink" is required');
  });

  it("clamps numbers and warns on keys it does not know", () => {
    const r = parsed({ ...EXAMPLE_THEME, radius: 400, chart: { barRadius: -3 }, mystery: 1 });
    expect(r.theme.radius).toBe(24);
    expect(r.theme.chart?.barRadius).toBe(0);
    expect(r.warnings.join(" ")).toContain('"mystery"');
  });

  it("compiles to presets that behave like any theme: pair, fonts, lab colors, chart style, card fonts", () => {
    const [light, dark] = compileTheme(parsed(EXAMPLE_THEME).theme);
    expect(light.dark).toBe(false); expect(dark.dark).toBe(true);
    expect(light.pair).toBe(dark.id); expect(dark.pair).toBe(light.id);
    expect(light.library && light.family).toBe("classic");
    expect(light.labColors?.anthropic).toBe("#C2410C");
    expect(paletteFor(dark).labColors?.anthropic).toBe("#F08A5D");
    expect(paletteFor(dark).style?.frontierColor).toBe("#5CC0EC");
    expect(light.fonts?.sans).toContain("Inter");
    for (const f of light.cardFonts ?? []) expect(existsSync(path.join(process.cwd(), "src/lib/og-fonts", f)), f).toBe(true);
    const vars = presetStyle(light);
    expect(vars["--bone"]).toBe("#F5F8FA");
    expect(Object.values(vars).join(" ")).not.toMatch(/[;{}]/);
  });

  it("travels in its own id: the id resolves everywhere a theme id does, in both modes", () => {
    const t = parsed(EXAMPLE_THEME).theme, id = themeId(t);
    expect(id.startsWith("u.")).toBe(true);
    expect(/^[A-Za-z0-9._-]+$/.test(id)).toBe(true);
    const light = themeById(id)!, dark = themeById(`${id}.d`)!;
    expect(light.name).toBe("Harbor"); expect(dark.name).toBe("Harbor Dark");
    expect(presetOf({ preset: id })).toBe(light);
    expect(resolvePreset({ preset: id }, true)).toBe(dark);
    expect(resolvePreset({ preset: id, mode: "fixed" }, true)).toBe(light);
    expect(pickerThemeOf(`${id}.d`)).toBe(light);
    expect(signaturePreset(t).id).toBe(id);
  });

  it("a one-mode theme forces that mode; a malformed or tampered id is just not a theme", () => {
    const t = parsed({ ...EXAMPLE_THEME, light: undefined }).theme, id = themeId(t), p = themeById(id)!;
    expect(p.dark).toBe(true); expect(p.pair).toBeUndefined();
    expect(themeById(`${id}.d`)).toBeUndefined();
    expect(inlinePreset("u.not-base64!!")).toBeUndefined();
    expect(inlinePreset("u.")).toBeUndefined();
    const evil = "u." + Buffer.from(JSON.stringify({ ...EXAMPLE_THEME, light: { ...EXAMPLE_THEME.light, bg: "red; x: y" } })).toString("base64url");
    expect(themeById(evil)).toBeUndefined();
    expect(presetOf({ preset: evil }).id).toBe("bone");
  });

  it("keeps non-ASCII names intact through the id", () => {
    const t = parsed({ ...EXAMPLE_THEME, name: "Océan 海" }).theme;
    expect(themeById(themeId(t))?.name).toBe("Océan 海");
  });

  it("offers only fonts the site bundles, and the prompt lists them all", () => {
    for (const n of THEME_FONT_NAMES) for (const f of THEME_FONTS[n].ttf) expect(existsSync(path.join(process.cwd(), "src/lib/og-fonts", f)), f).toBe(true);
    const prompt = themePrompt();
    for (const n of THEME_FONT_NAMES) expect(prompt).toContain(n);
  });

  it("the published skill teaches the same format as the validator", () => {
    const skill = readFileSync(path.join(process.cwd(), "public/skill/SKILL.md"), "utf8");
    for (const n of THEME_FONT_NAMES) expect(skill, n).toContain(n);
    expect(skill).toContain("priorsTheme");
    expect(skill).toContain("/api/theme");
  });
});
