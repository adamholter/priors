import type { PagePreset } from "./page-presets";

/**
 * The theme library behind "Explore themes". These presets resolve everywhere a theme id does
 * (`presetOf`, `themeById`, site theme, page theme, share cards) but are not in `THEME_CHOICES`, so
 * the default pickers stay as they were. Each is a lookalike of a real site: its own fonts, lab
 * colors, chart style and card treatment (`library` turns those on in `paletteFor` and `cardTheme`).
 * `cardFonts` are the TTFs in src/lib/og-fonts a share card draws with: [display, text 400/500/600, number 400/500].
 */
const font = (v: string, name: string, fallback: string) => `var(--font-${v}), '${name}', ${fallback}`;
const SANS = "system-ui, sans-serif";
const PRIORS_MONO = "var(--font-jetbrains), 'JetBrains Mono', Menlo, monospace";
const INTER = font("inter", "Inter", SANS), SERIF = font("source-serif", "Source Serif 4", "Georgia, serif");
const GEIST = { sans: font("geist", "Geist", SANS), serif: font("geist", "Geist", SANS), mono: font("geist-mono", "Geist Mono", "Menlo, monospace") };
const PLEX = font("plex-mono", "IBM Plex Mono", "Menlo, monospace");
const GEIST_CARD = ["Geist-400.ttf", "Geist-400.ttf", "Geist-500.ttf", "Geist-600.ttf", "GeistMono-400.ttf", "GeistMono-500.ttf"];
const INTER_CARD = ["Inter-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"];

/** Excalidraw's stroke palette (light) and its dark-mode filter output. Labs it doesn't color fall back to `other`. */
const SKETCH_LABS: Record<string, string> = {"openai": "#099268", "anthropic": "#e8590c", "google": "#1971c2", "meta": "#0c8599", "xai": "#1e1e1e", "deepseek": "#6741d9", "alibaba": "#f08c00", "moonshot": "#c2255c", "mistral": "#e03131", "zhipu": "#2f9e44", "xiaomi": "#846358", "minimax": "#9c36b5", "other": "#868e96"};
const SKETCH_DARK_LABS: Record<string, string> = {"openai": "#32a783", "anthropic": "#f17634", "google": "#56a2e8", "meta": "#3da5b6", "xai": "#d3d3d3", "deepseek": "#b595ff", "alibaba": "#fab005", "moonshot": "#ff8dbc", "mistral": "#ff8383", "zhipu": "#51cf66", "xiaomi": "#a98d84", "minimax": "#e28af8", "other": "#868e96"};
const SKETCH_FONTS = { sans: "var(--font-excalifont), Excalifont, 'Comic Sans MS', 'Segoe Print', cursive", serif: "var(--font-excalifont), Excalifont, 'Comic Sans MS', cursive", mono: "var(--font-comic-shanns), 'Comic Shanns', 'Comic Mono', ui-monospace, monospace" };
const SKETCH_CARD = ["Excalifont-Regular.ttf", "Excalifont-Regular.ttf", "Excalifont-Regular.ttf", "Excalifont-Regular.ttf", "ComicShanns-Regular.ttf", "ComicShanns-Regular.ttf"];
/** Phosphor-friendly marks for Terminal: warm amber and orange first, green and cyan where labs need telling apart. */
const TERMINAL_LABS: Record<string, string> = { anthropic: "#FF8A3D", openai: "#FFE08A", google: "#8FD694", meta: "#6FD0C8", xai: "#E8E0C8", spacexai: "#E8E0C8", deepseek: "#9DB4FF", alibaba: "#FFC247", moonshot: "#FF7AA8", mistral: "#FF6A4D", zhipu: "#B6E36F", minimax: "#D79BFF", xiaomi: "#FFA26B", other: "#B37800" };

export const LIBRARY_PRESETS: PagePreset[] = [
  { id: "hearingbench", name: "HearingBench", library: true, family: "classic", pair: "hearingbench-light", dark: true, bg: "#0A0A0A", surface: "#111111", ink: "#F5F5F5", ink2: "#C9C9C9", grey: "#8A8A8A", hair: "#262626", hair2: "#1A1A1A", accent: "#F4755F", panelAccent: "#CF4070",
    fonts: { sans: "system-ui, -apple-system, 'Segoe UI', sans-serif", serif: "system-ui, -apple-system, 'Segoe UI', sans-serif", mono: PRIORS_MONO }, radius: 10, chart: { grid: "solid", frontier: "solid", frontierColor: "#F4755F", barLabels: "top", barRadius: 4 } },
  { id: "hearingbench-light", name: "HearingBench Light", library: true, family: "classic", pair: "hearingbench", dark: false, bg: "#FFFFFF", surface: "#FFFFFF", ink: "#1D1730", ink2: "#4A4560", grey: "#6F6A82", hair: "#D8D7DE", hair2: "#EEEEF1", accent: "#CF4070", panelAccent: "#CF4070",
    fonts: { sans: "system-ui, -apple-system, 'Segoe UI', sans-serif", serif: "system-ui, -apple-system, 'Segoe UI', sans-serif", mono: PRIORS_MONO }, radius: 10, chart: { grid: "solid", frontier: "solid", frontierColor: "#CF4070", barLabels: "top", barRadius: 4 } },
  { id: "clutterbench", name: "ClutterBench", library: true, family: "classic", dark: false, bg: "#FFFFFF", surface: "#FFFFFF", ink: "#101828", ink2: "#475467", grey: "#667085", hair: "#E4E7EC", hair2: "#F5F7FA", accent: "#1971C2", panelAccent: "#1971C2",
    fonts: { sans: font("outfit", "Outfit", SANS), serif: font("outfit", "Outfit", SANS), mono: PRIORS_MONO }, radius: 8, cardFonts: ["Outfit-400.ttf", "Outfit-400.ttf", "Outfit-500.ttf", "Outfit-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"],
    chart: { grid: "solid", frontier: "solid", frontierColor: "#1971C2", barLabels: "top", barRadius: 6 } },
  { id: "frontiercode", name: "FrontierCode", library: true, family: "classic", dark: false, bg: "#F7F6F5", surface: "#FFFFFF", ink: "#000000", ink2: "#191919", grey: "#525252", hair: "#DEDCDB", hair2: "#ECEBEA", accent: "#2200FF", panelAccent: "#193CB8",
    fonts: { sans: INTER, serif: font("newsreader", "Newsreader", "Georgia, serif"), mono: font("geist-mono", "Geist Mono", "Menlo, monospace") }, radius: 0, cardFonts: ["Newsreader-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "GeistMono-400.ttf", "GeistMono-500.ttf"],
    chart: { grid: "dotted", frontier: "solid", frontierColor: "#2200FF", barLabels: "top", barRadius: 0 } },
  { id: "claude", name: "Claude", library: true, family: "classic", pair: "claude-dark", dark: false, bg: "#FAF9F5", surface: "#F0EEE6", ink: "#141413", ink2: "#3D3D3A", grey: "#6B6A63", hair: "#E8E6DC", hair2: "#F3F1EA", accent: "#A84A29", panelAccent: "#A84A29",
    fonts: { sans: font("poppins", "Poppins", SANS), serif: font("lora", "Lora", "Georgia, serif"), mono: PRIORS_MONO }, radius: 12, cardFonts: ["Lora-400.ttf", "Poppins-400.ttf", "Poppins-500.ttf", "Poppins-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"],
    chart: { grid: "solid", frontier: "solid", frontierColor: "#A84A29", barLabels: "top", barRadius: 4 } },
  { id: "claude-dark", name: "Claude Dark", library: true, family: "classic", pair: "claude", dark: true, bg: "#141413", surface: "#1F1E1D", ink: "#FAF9F5", ink2: "#C2C0B6", grey: "#9C9A92", hair: "#3D3D3A", hair2: "#262624", accent: "#D97757", panelAccent: "#A84A29",
    fonts: { sans: font("poppins", "Poppins", SANS), serif: font("lora", "Lora", "Georgia, serif"), mono: PRIORS_MONO }, radius: 12, cardFonts: ["Lora-400.ttf", "Poppins-400.ttf", "Poppins-500.ttf", "Poppins-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"],
    chart: { grid: "solid", frontier: "solid", frontierColor: "#D97757", barLabels: "top", barRadius: 4 } },
  { id: "terminal", name: "Terminal", library: true, family: "classic", dark: true, bg: "#000000", surface: "#0A0700", ink: "#FFB000", ink2: "#FF9900", grey: "#B37800", hair: "#5A3F00", hair2: "#1F1500", accent: "#FFB000", panelAccent: "#C24E00",
    fonts: { sans: PLEX, serif: PLEX, mono: PLEX }, labColors: TERMINAL_LABS, radius: 0, cardFonts: ["IBMPlexMono-400.ttf", "IBMPlexMono-400.ttf", "IBMPlexMono-500.ttf", "IBMPlexMono-500.ttf", "IBMPlexMono-400.ttf", "IBMPlexMono-500.ttf"],
    chart: { grid: "solid", frontier: "dotted", frontierColor: "#FFB000", barLabels: "top", barRadius: 0 } },
  { id: "ft", name: "Pink Paper", library: true, family: "classic", dark: false, bg: "#FFF1E5", surface: "#FFF8F1", ink: "#33302E", ink2: "#4D4845", grey: "#6E665F", hair: "#CCC1B7", hair2: "#F2DFCE", accent: "#0D7680", panelAccent: "#0D7680",
    fonts: { sans: INTER, serif: SERIF, mono: font("plex-mono", "IBM Plex Mono", "Menlo, monospace") }, radius: 2, cardFonts: ["SourceSerif4-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "IBMPlexMono-400.ttf", "IBMPlexMono-500.ttf"],
    chart: { grid: "solid", frontier: "solid", frontierColor: "#0D7680", barLabels: "top", barRadius: 0 } },
  { id: "geist", name: "Geist", library: true, family: "classic", pair: "geist-dark", dark: false, bg: "#FFFFFF", surface: "#FAFAFA", ink: "#171717", ink2: "#4D4D4D", grey: "#666666", hair: "#E5E5E5", hair2: "#F2F2F2", accent: "#0067D9", panelAccent: "#0067D9",
    fonts: GEIST, radius: 6, cardFonts: GEIST_CARD, chart: { grid: "solid", frontier: "solid", frontierColor: "#0067D9", barLabels: "top", barRadius: 4 } },
  { id: "geist-dark", name: "Geist Dark", library: true, family: "classic", pair: "geist", dark: true, bg: "#000000", surface: "#111111", ink: "#EDEDED", ink2: "#A1A1A1", grey: "#8F8F8F", hair: "#333333", hair2: "#1A1A1A", accent: "#3291FF", panelAccent: "#0070F3",
    fonts: GEIST, radius: 6, cardFonts: GEIST_CARD, chart: { grid: "solid", frontier: "solid", frontierColor: "#3291FF", barLabels: "top", barRadius: 4 } },
  { id: "linear", name: "Indigo Night", library: true, family: "classic", pair: "linear-light", dark: true, bg: "#08090A", surface: "#101113", ink: "#E2E4E7", ink2: "#B4B8BF", grey: "#8A8F98", hair: "#2E2F34", hair2: "#18191C", accent: "#8FA4FF", panelAccent: "#5E6AD2",
    fonts: { sans: INTER, serif: INTER, mono: PRIORS_MONO }, radius: 8, cardFonts: INTER_CARD, chart: { grid: "dotted", frontier: "solid", frontierColor: "#8FA4FF", barLabels: "top", barRadius: 3 } },
  { id: "linear-light", name: "Indigo Day", library: true, family: "classic", pair: "linear", dark: false, bg: "#FFFFFF", surface: "#F7F8F8", ink: "#08090A", ink2: "#3D3F44", grey: "#6B6F76", hair: "#E2E4E7", hair2: "#F1F2F4", accent: "#5560C8", panelAccent: "#5560C8",
    fonts: { sans: INTER, serif: INTER, mono: PRIORS_MONO }, radius: 8, cardFonts: INTER_CARD, chart: { grid: "dotted", frontier: "solid", frontierColor: "#5560C8", barLabels: "top", barRadius: 3 } },
  { id: "excalidraw", name: "Excalidraw", library: true, family: "sketch", pair: "excalidraw-dark", dark: false, bg: "#FFFFFF", surface: "#FFFFFF", ink: "#1E1E1E", ink2: "#343A40", grey: "#6E6E6E", hair: "#CED4DA", hair2: "#E9ECEF", accent: "#6965DB", panelAccent: "#6965DB",
    fonts: SKETCH_FONTS, labColors: SKETCH_LABS, radius: 14, cardFonts: SKETCH_CARD, chart: { grid: "dotted", frontier: "dotted", frontierColor: "#6965DB", barLabels: "top", barRadius: 2 } },
  { id: "excalidraw-dark", name: "Excalidraw Dark", library: true, family: "sketch", pair: "excalidraw", dark: true, bg: "#121212", surface: "#1E1E1E", ink: "#D3D3D3", ink2: "#B8B8B8", grey: "#8C8C8C", hair: "#3D3D3D", hair2: "#242424", accent: "#A8A5FF", panelAccent: "#6965DB",
    fonts: SKETCH_FONTS, labColors: SKETCH_DARK_LABS, radius: 14, cardFonts: SKETCH_CARD, chart: { grid: "dotted", frontier: "dotted", frontierColor: "#A8A5FF", barLabels: "top", barRadius: 2 } },
];

/** One picker card per theme, in each theme's signature mode. */
export const LIBRARY_CHOICE_IDS = ["hearingbench", "clutterbench", "frontiercode", "claude", "excalidraw", "terminal", "ft", "geist", "linear"];
