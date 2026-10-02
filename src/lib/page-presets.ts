/** Personal-page color schemes. Dark schemes set page colors; charts sit on light panels so they stay legible. */
export interface PagePreset { id: string; name: string; dark: boolean; bg: string; ink: string; ink2: string; grey: string; hair: string; hair2: string; accent: string; panelAccent?: string }

export const PAGE_PRESETS: PagePreset[] = [
  { id: "bone", name: "Bone", dark: false, bg: "#FBFBF9", ink: "#1A1A1A", ink2: "#4A4A46", grey: "#8A8A80", hair: "#DDDBD4", hair2: "#ECEAE3", accent: "#2F4FB0" },
  { id: "paper", name: "Paper", dark: false, bg: "#FFFFFF", ink: "#141414", ink2: "#46463F", grey: "#8A8A80", hair: "#E2E1DB", hair2: "#EFEEE9", accent: "#1F6F5C" },
  { id: "sand", name: "Sand", dark: false, bg: "#F4EFE6", ink: "#221D16", ink2: "#51483C", grey: "#8E8475", hair: "#DFD6C6", hair2: "#E9E2D5", accent: "#B4532A" },
  { id: "graphite", name: "Graphite", dark: true, bg: "#151515", ink: "#F2F1EC", ink2: "#CBCAC2", grey: "#8F8E87", hair: "#2F2F2C", hair2: "#252523", accent: "#9DB2FF", panelAccent: "#2F4FB0" },
  { id: "midnight", name: "Midnight", dark: true, bg: "#0D1220", ink: "#EEF1F8", ink2: "#C4CADA", grey: "#8B94AA", hair: "#253149", hair2: "#1B2438", accent: "#7FB2FF", panelAccent: "#2B5FC2" },
  { id: "forest", name: "Forest", dark: true, bg: "#0F1A15", ink: "#EDF3EE", ink2: "#C3D1C7", grey: "#8BA195", hair: "#233B2F", hair2: "#1A2D23", accent: "#6FD3A0", panelAccent: "#1F7A52" },
  /** The site's own dark mode. Bone pages switch to it when the visitor uses dark mode. */
  { id: "night", name: "Night", dark: true, bg: "#141413", ink: "#EDECE6", ink2: "#C2C1B9", grey: "#8C8B83", hair: "#34342F", hair2: "#1C1C1A", accent: "#9AABF5", panelAccent: "#3E5BC2" },
];
const NIGHT = PAGE_PRESETS.find((p) => p.id === "night")!;

/** The scheme a visitor sees: the owner's preset, except the default Bone follows the site's dark mode. */
export function resolvePreset(theme: { preset?: string; surface?: "bone" | "white" } | undefined, siteDark: boolean): PagePreset {
  const p = presetOf(theme);
  return siteDark && p.id === "bone" ? NIGHT : p;
}
/** Accent for a resolved preset. A Bone page shown as Night keeps a custom accent, lifted toward white so it reads on the dark page. */
export function resolveAccent(theme: { accent?: string } | undefined, preset: PagePreset): string {
  const a = theme?.accent;
  if (preset.id !== "night") return a ?? preset.accent;
  return !a || a.toLowerCase() === PAGE_PRESETS[0].accent.toLowerCase() || a.toLowerCase() === NIGHT.accent.toLowerCase() ? NIGHT.accent : `color-mix(in oklab, ${a} 62%, #ffffff)`;
}

export const ACCENTS = ["#2F4FB0", "#1F6F5C", "#B4532A", "#8A3FA0", "#C2410C", "#0F766E", "#1A1A1A"];

export function presetOf(theme?: { preset?: string; surface?: "bone" | "white" }): PagePreset {
  return PAGE_PRESETS.find((p) => p.id === theme?.preset) ?? (theme?.surface === "white" ? PAGE_PRESETS[1] : PAGE_PRESETS[0]);
}

export function presetStyle(p: PagePreset, accent?: string): Record<string, string> {
  const a = accent ?? p.accent;
  return {
    "--bone": p.bg, "--white": p.dark ? p.hair2 : "#FFFFFF", "--ink": p.ink, "--ink-2": p.ink2, "--grey": p.grey, "--hair": p.hair, "--hair-2": p.hair2,
    "--indigo": a, "--panel-accent": p.panelAccent ?? a,
    // Pages scope every site token, so a light page inside dark mode (or the reverse) stays coherent.
    "--indigo-fill": p.dark ? p.panelAccent ?? a : a, "--indigo-soft": `color-mix(in srgb, ${a} ${p.dark ? 18 : 12}%, ${p.bg})`, "--on-accent": "#FFFFFF",
    "--hair-3": `color-mix(in srgb, ${p.ink} ${p.dark ? 24 : 20}%, ${p.bg})`, "--shadow": p.dark ? "rgba(0, 0, 0, .55)" : "rgba(26, 26, 26, .22)", "--backdrop": p.dark ? "rgba(0, 0, 0, .55)" : "rgba(21, 26, 19, .34)",
    colorScheme: p.dark ? "dark" : "light", background: p.bg, color: p.ink,
  };
}
