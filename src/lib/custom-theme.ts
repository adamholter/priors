import type { ChartStyle, PagePreset } from "./page-presets";

/**
 * Bring-your-own themes. A theme is a small JSON file ("Priors theme", format 1) that an agent or a person writes and
 * uploads in Explore themes. It is validated strictly (hex colors, fonts from the bundled set, clamped numbers), so it
 * can never inject CSS, and compiled to the same PagePreset the built-in themes are.
 *
 * A custom theme travels as its own id: `u.<base64url of the minified JSON>` (the light version; the dark one, when the
 * theme has both, is `u.<same>.d`). Every place that takes a theme id (site theme, page theme, `theme=` in chart and
 * card links, the screenshot editor) therefore works with no database and no lookup: the server decodes the id again.
 */
export const THEME_FORMAT = 1;
export const MAX_THEME_JSON = 4000;

/** Fonts a theme may use: the ones the site, share cards and chart exports already bundle. */
export const THEME_FONTS = {
  "Inter": { kind: "sans", css: "--font-inter", ttf: ["Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf"] },
  "DM Sans": { kind: "sans", css: "--font-dm-sans", ttf: ["DMSans-400.ttf", "DMSans-500.ttf", "DMSans-600.ttf"] },
  "Geist": { kind: "sans", css: "--font-geist", ttf: ["Geist-400.ttf", "Geist-500.ttf", "Geist-600.ttf"] },
  "Outfit": { kind: "sans", css: "--font-outfit", ttf: ["Outfit-400.ttf", "Outfit-500.ttf", "Outfit-600.ttf"] },
  "Poppins": { kind: "sans", css: "--font-poppins", ttf: ["Poppins-400.ttf", "Poppins-500.ttf", "Poppins-600.ttf"] },
  "Switzer": { kind: "sans", css: "--font-switzer", ttf: ["Switzer-400.ttf", "Switzer-500.ttf", "Switzer-600.ttf"] },
  "Newsreader": { kind: "serif", css: "--font-newsreader", ttf: ["Newsreader-400.ttf"] },
  "Source Serif 4": { kind: "serif", css: "--font-source-serif", ttf: ["SourceSerif4-400.ttf"] },
  "Lora": { kind: "serif", css: "--font-lora", ttf: ["Lora-400.ttf"] },
  "JetBrains Mono": { kind: "mono", css: "--font-jetbrains", ttf: ["JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"] },
  "Geist Mono": { kind: "mono", css: "--font-geist-mono", ttf: ["GeistMono-400.ttf", "GeistMono-500.ttf"] },
  "IBM Plex Mono": { kind: "mono", css: "--font-plex-mono", ttf: ["IBMPlexMono-400.ttf", "IBMPlexMono-500.ttf"] },
  "Excalifont": { kind: "hand", css: "--font-excalifont", ttf: ["Excalifont-Regular.ttf"] },
  "Comic Shanns": { kind: "hand", css: "--font-comic-shanns", ttf: ["ComicShanns-Regular.ttf"] },
} as const;
export type ThemeFontName = keyof typeof THEME_FONTS;
export const THEME_FONT_NAMES = Object.keys(THEME_FONTS) as ThemeFontName[];
const FALLBACK = { sans: "system-ui, sans-serif", serif: "Georgia, serif", mono: "Menlo, monospace", hand: "'Comic Sans MS', cursive" } as const;

/** Lab ids the charts color. A mode's `labs` may name any of these (and `other`, for every lab not named). */
export const THEME_LAB_IDS = ["anthropic", "openai", "google", "meta", "xai", "deepseek", "alibaba", "moonshot", "mistral", "zhipu", "minimax", "xiaomi", "thinking-machines", "nvidia", "cursor", "cognition", "tencent", "other"];

export interface ThemeMode {
  bg: string; surface?: string; ink: string; ink2: string; grey: string; hair: string; hair2: string; accent: string; panelAccent?: string;
  labs?: Record<string, string>;
}
export interface ThemeDef {
  priorsTheme: 1; name: string;
  light?: ThemeMode; dark?: ThemeMode;
  fonts?: { sans?: ThemeFontName; serif?: ThemeFontName; mono?: ThemeFontName };
  radius?: number;
  chart?: { grid?: "solid" | "dotted"; frontier?: "solid" | "dotted"; barLabels?: "top" | "inside"; barRadius?: number; fill?: "flat" | "spectrogram" };
}

const COLOR_KEYS = ["bg", "surface", "ink", "ink2", "grey", "hair", "hair2", "accent", "panelAccent"] as const;
const REQUIRED = ["bg", "ink", "ink2", "grey", "hair", "hair2", "accent"] as const;

/** #RGB or #RRGGBB → #RRGGBB uppercase; anything else (names, rgb(), var(), url()) is rejected. */
export function normalizeHex(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return `#${h.toUpperCase()}`;
}
const channel = (c: number) => (c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
export const luminanceOf = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
export const contrastOf = (a: string, b: string) => { const [x, y] = [luminanceOf(a), luminanceOf(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export type ThemeParse = { ok: true; theme: ThemeDef; warnings: string[] } | { ok: false; errors: string[] };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined => (allowed as readonly unknown[]).includes(v) ? (v as T) : undefined;

function parseMode(key: "light" | "dark", raw: unknown, errors: string[], warnings: string[]): ThemeMode | undefined {
  if (!isObj(raw)) { errors.push(`"${key}" must be an object of colors.`); return undefined; }
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(raw)) if (k !== "labs" && !(COLOR_KEYS as readonly string[]).includes(k)) warnings.push(`"${key}.${k}" is not a Priors theme color and was ignored.`);
  for (const k of COLOR_KEYS) {
    if (raw[k] === undefined) { if ((REQUIRED as readonly string[]).includes(k)) errors.push(`"${key}.${k}" is required (a hex color like #1A1A1A).`); continue; }
    const hex = normalizeHex(raw[k]);
    if (!hex) errors.push(`"${key}.${k}" must be a hex color like #1A1A1A, got ${JSON.stringify(raw[k])}.`); else out[k] = hex;
  }
  if (raw.labs !== undefined) {
    if (!isObj(raw.labs)) errors.push(`"${key}.labs" must be an object of lab id → hex color.`);
    else {
      const labs: Record<string, string> = {};
      for (const [lab, c] of Object.entries(raw.labs)) {
        if (!/^[a-z0-9-]{1,32}$/.test(lab)) { errors.push(`"${key}.labs" has a bad lab id ${JSON.stringify(lab)} (lowercase letters, digits, dashes).`); continue; }
        const hex = normalizeHex(c);
        if (!hex) errors.push(`"${key}.labs.${lab}" must be a hex color, got ${JSON.stringify(c)}.`); else labs[lab] = hex;
      }
      if (Object.keys(labs).length > 40) errors.push(`"${key}.labs" has more than 40 entries.`);
      else if (Object.keys(labs).length) out.labs = labs;
    }
  }
  if (REQUIRED.some((k) => !out[k])) return undefined;
  const m = out as unknown as ThemeMode, bgLum = luminanceOf(m.bg);
  if (key === "light" && bgLum < 0.3) errors.push(`"light.bg" ${m.bg} is dark. The light version needs a light background (use "dark" for a dark one).`);
  if (key === "dark" && bgLum > 0.2) errors.push(`"dark.bg" ${m.bg} is light. The dark version needs a dark background (use "light" for a light one).`);
  const ink = contrastOf(m.ink, m.bg);
  if (ink < 4.5) errors.push(`"${key}.ink" ${m.ink} on "${key}.bg" ${m.bg} is ${ink.toFixed(1)}:1; body text needs at least 4.5:1.`);
  const surface = m.surface ?? m.bg;
  if (m.surface && contrastOf(m.ink, surface) < 4.5) errors.push(`"${key}.ink" ${m.ink} on "${key}.surface" ${surface} is ${contrastOf(m.ink, surface).toFixed(1)}:1; chart text needs at least 4.5:1.`);
  for (const k of ["ink2", "grey", "accent"] as const) {
    const c = contrastOf(m[k], m.bg);
    if (c < (k === "accent" ? 3 : 3.5)) warnings.push(`"${key}.${k}" ${m[k]} on the background is only ${c.toFixed(1)}:1; it will be hard to read.`);
  }
  // White text sits on the accent fill (buttons): the accent itself in light mode, panelAccent (or accent) in dark.
  const fill = key === "dark" ? m.panelAccent ?? m.accent : m.accent;
  if (contrastOf("#FFFFFF", fill) < 3) warnings.push(`White button text on ${fill} is only ${contrastOf("#FFFFFF", fill).toFixed(1)}:1.${key === "dark" ? ' Set "dark.panelAccent" to a deeper shade of the accent.' : ""}`);
  return m;
}

/** Validates a parsed JSON value. Strict about colors and fonts; unknown keys only warn. Pure: safe on the server. */
export function parseTheme(input: unknown): ThemeParse {
  const errors: string[] = [], warnings: string[] = [];
  if (!isObj(input)) return { ok: false, errors: ["A theme is a JSON object."] };
  if (input.priorsTheme !== THEME_FORMAT) errors.push(`"priorsTheme" must be ${THEME_FORMAT}.`);
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name) errors.push('"name" is required (a short title, at most 40 characters).'); else if (name.length > 40) errors.push('"name" is longer than 40 characters.');
  for (const k of Object.keys(input)) if (!["priorsTheme", "name", "light", "dark", "fonts", "radius", "chart"].includes(k)) warnings.push(`"${k}" is not part of the Priors theme format and was ignored.`);
  if (!input.light && !input.dark) errors.push('Give at least one of "light" or "dark".');
  const light = input.light !== undefined ? parseMode("light", input.light, errors, warnings) : undefined;
  const dark = input.dark !== undefined ? parseMode("dark", input.dark, errors, warnings) : undefined;

  let fonts: ThemeDef["fonts"];
  if (input.fonts !== undefined) {
    if (!isObj(input.fonts)) errors.push('"fonts" must be an object with sans, serif and mono.');
    else {
      fonts = {};
      for (const slot of ["sans", "serif", "mono"] as const) {
        const v = input.fonts[slot];
        if (v === undefined) continue;
        const f = oneOf(v, THEME_FONT_NAMES);
        if (!f) errors.push(`"fonts.${slot}" ${JSON.stringify(v)} is not available. Use one of: ${THEME_FONT_NAMES.join(", ")}.`); else fonts[slot] = f;
      }
    }
  }
  let radius: number | undefined;
  if (input.radius !== undefined) {
    if (typeof input.radius !== "number" || !Number.isFinite(input.radius)) errors.push('"radius" must be a number of pixels (0 to 24).');
    else radius = Math.min(24, Math.max(0, Math.round(input.radius)));
  }
  let chart: ThemeDef["chart"];
  if (input.chart !== undefined) {
    if (!isObj(input.chart)) errors.push('"chart" must be an object.');
    else {
      const c = input.chart;
      chart = {};
      for (const [k, allowed] of [["grid", ["solid", "dotted"]], ["frontier", ["solid", "dotted"]], ["barLabels", ["top", "inside"]], ["fill", ["flat", "spectrogram"]]] as const) {
        if (c[k] === undefined) continue;
        const v = oneOf(c[k], allowed as readonly string[]);
        if (!v) errors.push(`"chart.${k}" must be ${allowed.map((a) => `"${a}"`).join(" or ")}.`); else (chart as Record<string, string>)[k] = v;
      }
      if (c.barRadius !== undefined) { if (typeof c.barRadius !== "number" || !Number.isFinite(c.barRadius)) errors.push('"chart.barRadius" must be a number (0 to 12).'); else chart.barRadius = Math.min(12, Math.max(0, Math.round(c.barRadius))); }
    }
  }
  if (errors.length) return { ok: false, errors };
  const theme: ThemeDef = { priorsTheme: THEME_FORMAT, name, ...(light ? { light } : {}), ...(dark ? { dark } : {}), ...(fonts && Object.keys(fonts).length ? { fonts } : {}), ...(radius !== undefined ? { radius } : {}), ...(chart && Object.keys(chart).length ? { chart } : {}) };
  if (json(theme).length > MAX_THEME_JSON) return { ok: false, errors: [`The theme is larger than ${MAX_THEME_JSON} characters; trim lab colors you don't need.`] };
  return { ok: true, theme, warnings };
}

/** Text from a file or a chat paste (code fences and a sentence around the JSON are fine) → validated theme. */
export function parseThemeText(text: string): ThemeParse {
  let s = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) s = fence[1].trim();
  if (!s.startsWith("{")) { const a = s.indexOf("{"), b = s.lastIndexOf("}"); if (a >= 0 && b > a) s = s.slice(a, b + 1); }
  if (s.length > MAX_THEME_JSON * 4) return { ok: false, errors: ["That is far larger than a theme file."] };
  let value: unknown;
  try { value = JSON.parse(s); } catch (e) { return { ok: false, errors: [`That is not valid JSON (${e instanceof Error ? e.message : "parse error"}).`] }; }
  return parseTheme(value);
}

const json = (t: ThemeDef) => JSON.stringify(t);
const b64 = {
  enc: (s: string) => { const bytes = new TextEncoder().encode(s); let bin = ""; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  dec: (s: string) => { const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); },
};

export const INLINE_PREFIX = "u.";
/** The theme id that carries this theme: the light version's (or the only version's). */
export const themeId = (t: ThemeDef) => `${INLINE_PREFIX}${b64.enc(json(t))}`;
export const isInlineThemeId = (id: string | undefined): id is string => !!id && id.startsWith(INLINE_PREFIX);

const stack = (name: ThemeFontName) => { const f = THEME_FONTS[name]; return `var(${f.css}), '${name}', ${FALLBACK[f.kind]}`; };
const ttf = (name: ThemeFontName, weight: 0 | 1 | 2) => THEME_FONTS[name].ttf[Math.min(weight, THEME_FONTS[name].ttf.length - 1)];

/** The theme as presets: one per mode it defines, paired when it defines both. */
export function compileTheme(t: ThemeDef, id = themeId(t)): PagePreset[] {
  const both = !!(t.light && t.dark), sans = t.fonts?.sans ?? "Inter", serif = t.fonts?.serif ?? "Newsreader", mono = t.fonts?.mono ?? "JetBrains Mono";
  const fonts = { sans: stack(sans), serif: stack(serif), mono: stack(mono) };
  const cardFonts = [ttf(serif, 0), ttf(sans, 0), ttf(sans, 1), ttf(sans, 2), ttf(mono, 0), ttf(mono, 1)];
  const make = (mode: ThemeMode, dark: boolean, presetId: string, pair?: string): PagePreset => {
    const chart: ChartStyle = {
      grid: t.chart?.grid ?? "solid", frontier: t.chart?.frontier ?? "solid", frontierColor: mode.accent,
      barLabels: t.chart?.barLabels ?? "top", barRadius: t.chart?.barRadius ?? 3, ...(t.chart?.fill === "spectrogram" ? { fill: "spectrogram" as const } : {}),
    };
    return {
      id: presetId, name: both && dark ? `${t.name} Dark` : t.name, library: true, family: "classic", dark, pair,
      bg: mode.bg, surface: mode.surface ?? mode.bg, ink: mode.ink, ink2: mode.ink2, grey: mode.grey, hair: mode.hair, hair2: mode.hair2, accent: mode.accent, panelAccent: mode.panelAccent ?? mode.accent,
      fonts, radius: t.radius ?? 8, cardFonts, chart, ...(mode.labs ? { labColors: mode.labs } : {}),
    };
  };
  if (both) return [make(t.light!, false, id, `${id}.d`), make(t.dark!, true, `${id}.d`, id)];
  return t.light ? [make(t.light, false, id)] : [make(t.dark!, true, id)];
}

const cache = new Map<string, PagePreset>();
/** The preset a custom theme id names, or undefined for a malformed or invalid one. Memoized; cheap enough for render paths. */
export function inlinePreset(id: string | undefined): PagePreset | undefined {
  if (!isInlineThemeId(id) || id.length > MAX_THEME_JSON * 2) return undefined;
  const hit = cache.get(id);
  if (hit) return hit;
  let found: PagePreset | undefined;
  try {
    const dark = id.endsWith(".d"), base = dark ? id.slice(0, -2) : id;
    const parsed = parseTheme(JSON.parse(b64.dec(base.slice(INLINE_PREFIX.length))));
    // Compiled under the id as given, so a theme keeps its identity wherever the id was stored.
    if (parsed.ok) found = compileTheme(parsed.theme, base).find((p) => p.id === id);
  } catch { /* a malformed id is simply not a theme */ }
  // Only successes are kept, and at most 64: a bad id from a URL costs one small parse and no memory.
  if (found) { if (cache.size >= 64) cache.clear(); cache.set(id, found); }
  return found;
}

/** The preset a theme shows as in a picker: its light version, or its only one. */
export const signaturePreset = (t: ThemeDef) => compileTheme(t)[0];

/** A theme file the user can start from. Also the example inside the agent prompt. */
export const EXAMPLE_THEME: ThemeDef = {
  priorsTheme: 1, name: "Harbor",
  light: { bg: "#F5F8FA", surface: "#FFFFFF", ink: "#10222E", ink2: "#3F5563", grey: "#677C89", hair: "#D2DDE3", hair2: "#E6EDF1", accent: "#0B6E99", labs: { anthropic: "#C2410C", openai: "#10222E", google: "#2B7A4B", meta: "#0B6E99", xai: "#6B4FB3", deepseek: "#1F3FBF", other: "#8A9BA6" } },
  dark: { bg: "#0B1620", surface: "#122230", ink: "#E8F0F5", ink2: "#B6C7D2", grey: "#8196A4", hair: "#25394A", hair2: "#1A2C3B", accent: "#5CC0EC", panelAccent: "#0B6E99", labs: { anthropic: "#F08A5D", openai: "#E8F0F5", google: "#5FCB8A", meta: "#5CC0EC", xai: "#A28CE8", deepseek: "#7B95FF", other: "#7F93A1" } },
  fonts: { sans: "Inter", serif: "Newsreader", mono: "JetBrains Mono" },
  radius: 8,
  chart: { grid: "solid", frontier: "solid", barLabels: "top", barRadius: 4, fill: "flat" },
};

/** The prompt a person pastes into their agent. The format lives here and nowhere else, so it cannot drift from the validator. */
export function themePrompt(): string {
  return `You are making a theme for Priors (mypriors.com), a site that ranks AI models with charts and rankings. Output ONE JSON file in the "Priors theme" format below, and nothing else.

MY THEME: <describe the look you want here: a mood, a brand, a website to match, colors, fonts>

FORMAT (JSON, format version ${THEME_FORMAT}):
- "priorsTheme": ${THEME_FORMAT}
- "name": short title, at most 40 characters.
- "light" and/or "dark": the colors for that mode. Give both when you can, so the site can follow the visitor's light/dark setting. Each is an object of #hex colors:
  - bg: page background. Light mode needs a light color, dark mode a dark one.
  - surface (optional): cards, panels and chart backgrounds. Defaults to bg.
  - ink: main text. At least 4.5:1 contrast against bg (and surface).
  - ink2: secondary text. grey: captions and axis labels. At least 3.5:1 against bg.
  - hair: borders and gridlines. hair2: subtle fills, such as bar tracks and hovers.
  - accent: links, selected states, buttons. At least 3:1 against bg; white text sits on it in light mode.
  - panelAccent (dark mode, optional): a deeper shade of the accent that holds white button text.
  - labs (optional): chart colors per AI lab, an object of lab id → #hex. Lab ids: ${THEME_LAB_IDS.join(", ")}. "other" colors every lab you don't name. Skip "labs" to keep Priors' default lab colors. Make the colors distinguishable from each other and from bg, and on dark backgrounds lighter than on light ones.
- "fonts" (optional): { "sans", "serif", "mono" }, each one of: ${THEME_FONT_NAMES.join(", ")}. Only these are available; do not invent others. sans is body text, serif is headings, mono is numbers and labels.
- "radius" (optional): corner roundness in px, 0 to 24 (0 square, 8 soft, 16+ bubbly).
- "chart" (optional): { "grid": "solid" | "dotted", "frontier": "solid" | "dotted", "barLabels": "top" | "inside", "barRadius": 0-12, "fill": "flat" | "spectrogram" }. "spectrogram" fills bars and dots with a gradient ramp of each lab's color.

RULES:
- Colors are #RGB or #RRGGBB hex only. No color names, rgb(), var() or urls.
- No comments, no trailing commas, no keys other than the ones above.
- Pick a coherent palette: one accent, neutral surfaces tinted toward it, text colors derived from it.

VALIDATE (optional): POST the JSON to https://mypriors.com/api/theme (Content-Type: application/json). It replies { "ok": true, "warnings": [...] } or { "ok": false, "errors": [...] }. Fix every error and re-check until ok.

EXAMPLE:
${JSON.stringify(EXAMPLE_THEME, null, 2)}

Save the result as my-theme.json. I will upload it in Priors → Settings → Theme → Explore themes → Bring your own theme.`;
}
