/**
 * Personal-page themes. A theme is a whole look: page colors, fonts, lab colors, card treatment and
 * chart style. `family` switches a scoped stylesheet (src/components/page/themes.css) that changes
 * layout details; colors and fonts arrive as CSS variables from `presetStyle`. Themes with a `pair`
 * have a light and a dark version; the visitor's site mode picks one unless the owner locks it.
 */
export type ThemeFamily = "priors" | "aa" | "slop" | "classic";
export interface ChartStyle {
  /** Gridlines: hairline or AA's dotted rules. */
  grid?: "solid" | "dotted";
  /** Pareto frontier line style and color (defaults to ink). */
  frontier?: "solid" | "dotted";
  frontierColor?: string;
  /** Shade the better corner of score-vs-metric scatters (AA's "most attractive quadrant"). */
  quadrant?: string;
  /** Bar value labels above the bar, or inside its top in white (AA). */
  barLabels?: "top" | "inside";
  barRadius?: number;
}
export interface PagePreset {
  id: string; name: string; dark: boolean; bg: string; ink: string; ink2: string; grey: string; hair: string; hair2: string; accent: string; panelAccent?: string;
  family?: ThemeFamily;
  /** The same theme in the other mode. */
  pair?: string;
  /** Card/panel background; defaults to white on light themes, hair2 on dark. */
  surface?: string;
  fonts?: { sans: string; serif: string; mono: string };
  /** Lab id → mark color, replacing Priors' lab colors in every chart on the page. */
  labColors?: Record<string, string>;
  chart?: ChartStyle;
  /** Corner radius for cards and controls, px. */
  radius?: number;
}

const PRIORS_FONTS = { sans: "var(--font-inter), Inter, system-ui, sans-serif", serif: "var(--font-newsreader), Newsreader, Georgia, serif", mono: "var(--font-jetbrains), 'JetBrains Mono', Menlo, monospace" };
/** Switzer (Fontshare, free for commercial use) is the closest free match for AA's Suisse Int'l; Source Serif 4 stands in for its serif headings. */
const AA_FONTS = { sans: "var(--font-switzer), Switzer, 'Helvetica Neue', Arial, sans-serif", serif: "var(--font-source-serif), 'Source Serif 4', Georgia, serif", mono: "var(--font-switzer), Switzer, 'Helvetica Neue', Arial, sans-serif" };
const SLOP_FONTS = { sans: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif", serif: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif", mono: "var(--font-dm-sans), 'DM Sans', system-ui, sans-serif" };

/** Artificial Analysis creator colors, keyed by Priors lab ids. */
const AA_LABS: Record<string, string> = {
  anthropic: "#cc785c", openai: "#1f1f1f", google: "#34A853", meta: "#0089f4", xai: "#736cd3", spacexai: "#736cd3", deepseek: "#2243e6", alibaba: "#ff7018",
  moonshot: "#047AFE", mistral: "#f32e02", zhipu: "#1c7ff8", minimax: "#EB3568", xiaomi: "#ff6900", "thinking-machines": "#676767", nvidia: "#76b900",
  stepfun: "#00F5E7", inception: "#021B30", microsoft: "#0078D5", cohere: "#D18EE2", "ant-group": "#4fb5ff", tencent: "#3c8bff", cognition: "#1B818E", cursor: "#505050", other: "#909090",
};
const AA_DARK_LABS: Record<string, string> = { ...AA_LABS, openai: "#E6E6E6", inception: "#7A94B8", deepseek: "#5C78FF", cursor: "#A0A0A0" };
/** Slopalytics' light-dark() lab pairs. Labs it doesn't color fall back to neutral greys. */
const SLOP_LIGHT_LABS: Record<string, string> = { openai: "#303840", anthropic: "#ae5235", google: "#218347", xai: "#6d55bd", spacexai: "#6d55bd", meta: "#236bbd", moonshot: "#ab3f83", zhipu: "#8e7318", deepseek: "#157d83", xiaomi: "#b85212", alibaba: "#8a5a9e", mistral: "#b0503a", minimax: "#9e6a1f", other: "#77716c" };
const SLOP_DARK_LABS: Record<string, string> = { openai: "#f1f3f5", anthropic: "#df9477", google: "#56ca80", xai: "#9b94ee", spacexai: "#9b94ee", meta: "#5ea4ff", moonshot: "#ee86c4", zhipu: "#ecd36e", deepseek: "#52cdd2", xiaomi: "#ff8b45", alibaba: "#c79ae0", mistral: "#f08a6c", minimax: "#e8b45a", other: "#aaa39d" };

export const PAGE_PRESETS: PagePreset[] = [
  { id: "bone", name: "Priors Light", family: "priors", pair: "night", dark: false, bg: "#FBFBF9", ink: "#1A1A1A", ink2: "#4A4A46", grey: "#8A8A80", hair: "#DDDBD4", hair2: "#ECEAE3", accent: "#2F4FB0", fonts: PRIORS_FONTS, radius: 4 },
  /** The site's own dark mode. Priors Light pages switch to it when the visitor uses dark mode. */
  { id: "night", name: "Priors Dark", family: "priors", pair: "bone", dark: true, bg: "#141413", ink: "#EDECE6", ink2: "#C2C1B9", grey: "#8C8B83", hair: "#34342F", hair2: "#1C1C1A", accent: "#9AABF5", panelAccent: "#3E5BC2", fonts: PRIORS_FONTS, radius: 4 },
  { id: "aa", name: "Analysis", family: "aa", pair: "aa-dark", dark: false, bg: "#FFFFFF", surface: "#FFFFFF", ink: "#000000", ink2: "#3F3F46", grey: "#71717A", hair: "#E4E4E7", hair2: "#F4F4F5", accent: "#7F4BF3", panelAccent: "#7F4BF3", fonts: AA_FONTS, labColors: AA_LABS, radius: 8,
    chart: { grid: "dotted", frontier: "dotted", frontierColor: "#000000", quadrant: "#DFF7DF", barLabels: "inside", barRadius: 3 } },
  { id: "aa-dark", name: "Analysis Dark", family: "aa", pair: "aa", dark: true, bg: "#0A0A0A", surface: "#141414", ink: "#FAFAFA", ink2: "#D4D4D8", grey: "#A1A1AA", hair: "#27272A", hair2: "#18181B", accent: "#A78BFA", panelAccent: "#7F4BF3", fonts: AA_FONTS, labColors: AA_DARK_LABS, radius: 8,
    chart: { grid: "dotted", frontier: "dotted", frontierColor: "#FAFAFA", quadrant: "#0F2716", barLabels: "inside", barRadius: 3 } },
  { id: "slop", name: "Slop", family: "slop", pair: "slop-light", dark: true, bg: "#000000", surface: "#000000", ink: "#FFFFFF", ink2: "#AAA39D", grey: "#77716C", hair: "#1C1A18", hair2: "#0D0B0A", accent: "#C5AC98", panelAccent: "#806047", fonts: SLOP_FONTS, labColors: SLOP_DARK_LABS, radius: 2,
    chart: { grid: "dotted", frontier: "solid", frontierColor: "#C5AC98", barLabels: "top", barRadius: 1 } },
  { id: "slop-light", name: "Slop Light", family: "slop", pair: "slop", dark: false, bg: "#FFFFFF", surface: "#FFFFFF", ink: "#20201E", ink2: "#625D57", grey: "#77716C", hair: "#E8E4DF", hair2: "#F8F6F3", accent: "#806047", fonts: SLOP_FONTS, labColors: SLOP_LIGHT_LABS, radius: 2,
    chart: { grid: "dotted", frontier: "solid", frontierColor: "#806047", barLabels: "top", barRadius: 1 } },
  { id: "paper", name: "Paper", family: "classic", dark: false, bg: "#FFFFFF", ink: "#141414", ink2: "#46463F", grey: "#8A8A80", hair: "#E2E1DB", hair2: "#EFEEE9", accent: "#1F6F5C", fonts: PRIORS_FONTS, radius: 4 },
  { id: "sand", name: "Sand", family: "classic", dark: false, bg: "#F4EFE6", ink: "#221D16", ink2: "#51483C", grey: "#8E8475", hair: "#DFD6C6", hair2: "#E9E2D5", accent: "#B4532A", fonts: PRIORS_FONTS, radius: 4 },
  { id: "graphite", name: "Graphite", family: "classic", dark: true, bg: "#151515", ink: "#F2F1EC", ink2: "#CBCAC2", grey: "#8F8E87", hair: "#2F2F2C", hair2: "#252523", accent: "#9DB2FF", panelAccent: "#2F4FB0", fonts: PRIORS_FONTS, radius: 4 },
  { id: "midnight", name: "Midnight", family: "classic", dark: true, bg: "#0D1220", ink: "#EEF1F8", ink2: "#C4CADA", grey: "#8B94AA", hair: "#253149", hair2: "#1B2438", accent: "#7FB2FF", panelAccent: "#2B5FC2", fonts: PRIORS_FONTS, radius: 4 },
  { id: "forest", name: "Forest", family: "classic", dark: true, bg: "#0F1A15", ink: "#EDF3EE", ink2: "#C3D1C7", grey: "#8BA195", hair: "#233B2F", hair2: "#1A2D23", accent: "#6FD3A0", panelAccent: "#1F7A52", fonts: PRIORS_FONTS, radius: 4 },
];
const byId = new Map(PAGE_PRESETS.map((p) => [p.id, p]));
const NIGHT = byId.get("night")!;
/** Themes shown in the picker, one card per light/dark pair, in each theme's signature mode. */
export const THEME_CHOICES = ["bone", "aa", "slop", "paper", "sand", "graphite", "midnight", "forest"].map((id) => byId.get(id)!);

type ThemeRef = { preset?: string; surface?: "bone" | "white"; mode?: "auto" | "fixed" } | undefined;

/**
 * The theme a visitor sees. Paired themes follow the visitor's site mode unless the owner fixed
 * the mode; unpaired (classic) themes always show as chosen.
 */
export function resolvePreset(theme: ThemeRef, siteDark: boolean): PagePreset {
  const p = presetOf(theme);
  if (theme?.mode === "fixed" || !p.pair || p.dark === siteDark) return p;
  return byId.get(p.pair) ?? p;
}
/** Accent for a resolved theme. A custom accent picked on one mode is lifted or deepened for the other. */
export function resolveAccent(theme: { accent?: string; preset?: string } | undefined, preset: PagePreset): string {
  const a = theme?.accent, chosen = presetOf(theme);
  if (!a || a.toLowerCase() === chosen.accent.toLowerCase()) return preset.accent;
  if (preset.id === chosen.id || preset.dark === chosen.dark) return a;
  if (preset.id === NIGHT.id && a.toLowerCase() === byId.get("bone")!.accent.toLowerCase()) return NIGHT.accent;
  return preset.dark ? `color-mix(in oklab, ${a} 62%, #ffffff)` : `color-mix(in oklab, ${a} 70%, #000000)`;
}

export const ACCENTS = ["#2F4FB0", "#1F6F5C", "#B4532A", "#8A3FA0", "#C2410C", "#0F766E", "#1A1A1A", "#7F4BF3", "#806047"];

export function presetOf(theme?: ThemeRef): PagePreset {
  return byId.get(theme?.preset ?? "") ?? (theme?.surface === "white" ? byId.get("paper")! : byId.get("bone")!);
}
export const themeById = (id: string | undefined) => (id ? byId.get(id) : undefined);

export function presetStyle(p: PagePreset, accent?: string): Record<string, string> {
  const a = accent ?? p.accent, fonts = p.fonts ?? PRIORS_FONTS;
  return {
    "--bone": p.bg, "--white": p.surface ?? (p.dark ? p.hair2 : "#FFFFFF"), "--ink": p.ink, "--ink-2": p.ink2, "--grey": p.grey, "--hair": p.hair, "--hair-2": p.hair2,
    "--indigo": a, "--panel-accent": p.panelAccent ?? a,
    // Pages scope every site token, so a light page inside dark mode (or the reverse) stays coherent.
    "--indigo-fill": p.dark ? p.panelAccent ?? a : a, "--indigo-soft": `color-mix(in srgb, ${a} ${p.dark ? 18 : 12}%, ${p.bg})`, "--on-accent": "#FFFFFF",
    "--hair-3": `color-mix(in srgb, ${p.ink} ${p.dark ? 24 : 20}%, ${p.bg})`, "--shadow": p.dark ? "rgba(0, 0, 0, .55)" : "rgba(26, 26, 26, .22)", "--backdrop": p.dark ? "rgba(0, 0, 0, .55)" : "rgba(21, 26, 19, .34)",
    "--font-sans": fonts.sans, "--font-serif": fonts.serif, "--font-mono": fonts.mono, "--page-radius": `${p.radius ?? 4}px`,
    colorScheme: p.dark ? "dark" : "light", background: p.bg, color: p.ink, fontFamily: fonts.sans,
  };
}
