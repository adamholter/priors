# Design system

Brand boards live outside the repo at `~/priors-brand/index.html`.

## Rules

- No taglines, no pills or chips, no gradients.
- Never hardcode a hex color in a component. Use the tokens. (The share-card renderer and page presets are the exceptions: they define palettes.)
- No em dashes in user-facing copy.
- One accent: indigo, the dot of the i in the wordmark.

## Tokens

Defined in `src/app/globals.css`.

| | Light | Dark (`:root[data-theme="dark"]`) |
| --- | --- | --- |
| Background | bone `#FBFBF9` | warm near-black `#141413` |
| Raised surface (`--white`) | white | `#1C1C1A` |
| Ink | `#1A1A1A` | `#EDECE6` |
| Accent text (`--indigo`) | `#2F4FB0` | `#9AABF5` |
| Button fill (`--indigo-fill`, text `--on-accent`) | `#2F4FB0` | `#3E5BC2` |

Plus warm grey, hairlines, and `--brand-i` for the wordmark's i.

`src/onboarding/onboarding.css` keeps its literals in generated `--ob-*` variables (light is the original literal, dark is the mapped value).

## Type

Newsreader (display and serif), Inter (text), JetBrains Mono (numbers). Themed pages bring their own: see `docs/pages-and-sharing.md`.

## Large screens

The builder grows with the screen (`src/components/builder.css`, `builder-size.ts`). From 1024px it centers within 1720px. From 1280px text, ranking rows and the sidebar scale 1.1×, from 1600px 1.2×. The header and sidebar use CSS `zoom`, and dialogs and the benchmark sheet opened from them undo it so they still fit the screen. Charts never sit under a zoom (ECharts misreads the pointer there): they take the same scale through `ChartPalette.size` (text, marks, plot height, ranking row pitch), which is 1 everywhere else. Phones keep their layout, with slightly larger chart dots.

## Light and dark

`src/components/Theme.tsx`. System default; the Mode control in Settings pins `localStorage["priors:theme"]` (mirrored in the `priors_theme` cookie). Published pages keep the moon toggle. No flash of white for a dark system: the root `viewport` declares `colorScheme: "light dark"`, and an inline `<style>` (`THEME_CRITICAL_CSS` in `src/lib/theme-critical.ts`) paints the dark page color while `<html>` has no `data-theme`, so the first paint is dark even before the stylesheet or the head script run. The head script then sets the real scheme.

**Site theme.** The gear in every header (`SiteSettings.tsx`) opens Settings: any page theme (`THEME_CHOICES`) can be the visitor's theme for the builder, Explore, model pages and onboarding. `src/lib/site-theme.ts` turns a preset into site tokens (`presetStyle` plus the wordmark i and onboarding's surface tokens) and sets them inline on `<html>`; Priors sets nothing. `localStorage["priors:site-theme"]` holds the id and both modes' tokens so the no-flash script paints them before React. Single-mode themes force the scheme (Midnight is always dark). The root `ChartPaletteContext` uses `paletteFor(preset)`, so lab colors and chart style follow. `.page-root` sets its owner's tokens on top, so published pages are unchanged; family stylesheets (layout details) apply only on pages.

The picker also has "Explore themes", a library of extra looks (see `docs/pages-and-sharing.md`); a library theme is a site theme the same way.

- The no-flash script is first in `<body>`, not in `<head>`: in `<head>` it caused a hydration error on static pages.
- The root `ChartPaletteContext` switches charts between `LIGHT_PALETTE` and `DARK_PALETTE` (or the site theme's palette).
- Lab colors have dark-tuned versions. Never read `lab.color` directly for display: use `markColor()` in charts and `useLabColor()` in the DOM.

## Motion

- Rankings are keyed rows moving between list-local positions. See `docs/charts.md` for why viewport FLIP is banned.
- Animations honor `prefers-reduced-motion`.
- Page transitions use `PageTransition.tsx` and `transitionTypes` on links.
