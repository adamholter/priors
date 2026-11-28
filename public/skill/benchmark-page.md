# Priors: editing a benchmark's page as its creator

A benchmark's verified creator can add their own content to its page on Priors (`mypriors.com/benchmarks/<id>`): an interactive embed (a clip player, a search tool, a chart, a small game) or plain text, above or below the leaderboard. Priors' own sections (leaderboard, quality, charts, all results) stay as they are.

## Who can

Only verified creators. Adam verifies creators himself: the creator tells him their Priors handle (claim one at mypriors.com first), and he grants that page the benchmark. Until then every write tool here answers 403. The write tools use the same agent token as the user's own page (Edit page, Agent access). `my_benchmarks` lists what the token's page may edit.

## Tools

| Tool | Does |
|---|---|
| `my_benchmarks` | The benchmarks this page is a verified creator of, with their blocks |
| `get_benchmark_blocks` | One page's blocks in full, hidden ones too |
| `upsert_benchmark_block` | Add a block, or change the one with the same `id` (fields you leave out keep their value) |
| `remove_benchmark_block` | Remove a block |
| `set_benchmark_blocks` | Replace or reorder every block at once; `[]` clears the page |
| `preview_benchmark_embed` | No token, publishes nothing: returns an HTML file that runs your embed exactly as the page will, with the benchmark's real rows and a light/dark switch |
| `get_benchmark_page` | What visitors see now |

A block is `{ id, kind: "embed" | "text", title?, html?, body?, height?, placement?: "above" | "below", hidden? }`. `hidden: true` keeps it off the public page while the creator, signed in, still sees it there (dashed outline). At most 12 blocks, 400 KB of HTML per embed and about 900 KB in all.

Workflow: write the HTML, run `preview_benchmark_embed`, save its `document` to a file, open it in a browser (or screenshot it with a headless browser) in both modes, fix, then `upsert_benchmark_block`. Publish with `hidden: true` first when the user wants to look before visitors do. After writing, call `get_benchmark_page` to check.

## The embed contract

An embed's `html` is a fragment or a full HTML document. Priors runs it in a sandboxed frame the width of the page column, and puts its own head in front of yours:

- **Sandbox.** Scripts, forms, pointer lock, fullscreen, downloads and audio all work. The frame has no access to Priors: no cookies, no storage of the site, no reading the parent page, no navigating the tab. It cannot open windows or dialogs: `window.open`, `alert` and `confirm` do nothing. Plain `<a href="https://…">` links open in a new tab when clicked (the page opens them); from code, call `priors.openLink(url)` in a click handler.
- **Network.** Load anything from your own host or a CDN: `<img>`, `<audio>`, `<video>`, `<script src>`, `<link rel=stylesheet>` work as on any page. `fetch()` and XHR go out with `Origin: null`, so the server must answer with `Access-Control-Allow-Origin: *`. Keep big files (audio, models, datasets) on your host rather than inlining them.
- **Height.** With no `height`, the frame follows the height of your `<body>` as it changes. Do not size the root to `100vh` or `height: 100%` in that mode, since the frame takes its height from your content. For a canvas or game that wants a fixed box, set `height` (60 to 4000 px) and fill it with `100vh`.
- **Theme.** Your document matches the page in light and dark, and follows it when the visitor switches. Use these CSS variables instead of fixed colors:

| variable | use |
|---|---|
| `--priors-bg`, `--priors-surface` | page background, card and control background |
| `--priors-text`, `--priors-text-2`, `--priors-muted` | text: main, secondary, faint |
| `--priors-border`, `--priors-border-soft`, `--priors-border-strong` | rules and outlines |
| `--priors-accent`, `--priors-accent-soft` | links and highlights, a tinted fill |
| `--priors-accent-fill`, `--priors-on-accent` | a solid accent button and its text |
| `--priors-good`, `--priors-warn`, `--priors-danger` | states |
| `--priors-font-sans`, `--priors-font-serif`, `--priors-font-mono` | Inter, Newsreader, JetBrains Mono (loaded for you) |

  The frame's background is transparent so the page shows through; draw on `--priors-surface` for a card. `html[data-theme]` is `light` or `dark` for CSS that needs it. The base style sets the body to 14px Inter in `--priors-text` with no margin.
- **The bridge.** `window.priors` exists before your scripts run:

```js
priors.benchmark            // { id, name, unit, higherIsBetter, url }
priors.theme                // { mode: "light" | "dark", colors: { bg, text, accent, ... }, fonts }
priors.onTheme(fn)          // fn(theme) on every switch (for canvas or chart colors); returns an unsubscribe
priors.rows()               // Promise of the leaderboard as the visitor sees it, in order:
                            //   [{ rank, model, modelId, lab, color, effort, value, score, ci, costUsd, released, url }]
                            //   value is the benchmark's own number, score is Priors' 0 to 100, color is the lab's chart color
priors.open(row.url)        // in a click handler: go to a model, benchmark or compare page on Priors
priors.openLink(url)        // in a click handler: open an http(s) address in a new tab
```

  Match your own records to rows by `modelId` or a normalized name: Priors' names drop some prefixes ("Fable 5.2" for "Claude Fable 5.2").

## Good embeds

- Show what only the creator can: the outputs behind the scores (clips, images, transcripts, replays), per-task results, a way to search them.
- Make it look like part of Priors: the theme variables, the page's fonts, quiet borders, no heavy shadows or a second color scheme.
- Work at phone width (about 340 px) and in both modes.
- Never invent or restate scores that differ from the leaderboard; take numbers from `priors.rows()` or your published data.

## Report

Say which blocks changed, whether they are hidden, and give the page link (the write tools return it).
