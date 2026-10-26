import { presetStyle, themeById, type PagePreset } from "./page-presets";

/**
 * The visitor's own theme for the site (builder, Explore, model pages, onboarding), picked from the
 * page themes in Settings. Priors (bone/night) is the site's built-in look and sets nothing. Any
 * other theme overrides the site's color and font tokens on <html>. Published pages keep their
 * owner's theme: `.page-root` sets its own tokens on top.
 */
export const SITE_THEME_KEY = "priors:site-theme";
export const DEFAULT_SITE_THEME = "bone";

/** What localStorage holds: the theme id plus the tokens of each mode, so the head script can paint them before React loads. */
export interface SavedSiteTheme { id: string; light?: Record<string, string>; dark?: Record<string, string> }

/** The theme's light and dark versions. Single-mode themes have one, and force the site into it. */
export function siteThemeModes(id: string): { light?: PagePreset; dark?: PagePreset } {
  const p = themeById(id);
  if (!p) return {};
  const pair = themeById(p.pair);
  return p.dark ? { dark: p, light: pair } : { light: p, dark: pair };
}

/** The preset to paint and whether the site is dark. No preset means the site's built-in look. */
export function resolveSiteTheme(id: string, wantDark: boolean): { preset?: PagePreset; dark: boolean } {
  if (id === DEFAULT_SITE_THEME || !themeById(id)) return { dark: wantDark };
  const modes = siteThemeModes(id), preset = (wantDark ? modes.dark : modes.light) ?? modes.dark ?? modes.light!;
  return { preset, dark: preset.dark };
}

/** Site tokens for a theme: the page tokens, plus the brand mark and onboarding's surfaces. */
export function siteThemeVars(p: PagePreset): Record<string, string> {
  const vars = Object.fromEntries(Object.entries(presetStyle(p)).filter(([k]) => k.startsWith("--")));
  const fill = vars["--indigo-fill"], toward = p.dark ? "#FFFFFF" : "#000000";
  return {
    ...vars, "--brand-i": vars["--indigo"],
    "--ob-fbfbf9": p.bg, "--ob-ffffff": vars["--white"], "--ob-1a1a1a": p.ink, "--ob-f1f0eb": p.hair2, "--ob-dddbd4": p.hair, "--ob-d9dbd0": p.hair,
    "--indigo-fill-hover": `color-mix(in srgb, ${fill} 86%, ${toward})`, "--indigo-depth-243e8d": `color-mix(in srgb, ${fill} 78%, #000000)`, "--indigo-depth-203778": `color-mix(in srgb, ${fill} 70%, #000000)`,
  };
}

export function savedSiteTheme(id: string): SavedSiteTheme | null {
  if (id === DEFAULT_SITE_THEME || !themeById(id)) return null;
  const { light, dark } = siteThemeModes(id);
  return { id, ...(light ? { light: siteThemeVars(light) } : {}), ...(dark ? { dark: siteThemeVars(dark) } : {}) };
}
