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

`src/components/Theme.tsx`. System default; the toggle pins `localStorage["priors:theme"]` (mirrored in the `priors_theme` cookie).

- The no-flash script is first in `<body>`, not in `<head>`: in `<head>` it caused a hydration error on static pages.
- The root `ChartPaletteContext` switches charts between `LIGHT_PALETTE` and `DARK_PALETTE`.
- Lab colors have dark-tuned versions. Never read `lab.color` directly for display: use `markColor()` in charts and `useLabColor()` in the DOM.

## Motion

- Rankings are keyed rows moving between list-local positions. See `docs/charts.md` for why viewport FLIP is banned.
- Animations honor `prefers-reduced-motion`.
- Page transitions use `PageTransition.tsx` and `transitionTypes` on links.
