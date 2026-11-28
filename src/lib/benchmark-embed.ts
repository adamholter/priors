/**
 * Embeds on benchmark pages: HTML a benchmark's verified creator wrote (a spectrogram player, a search box, a little game), run in a
 * sandboxed frame. The frame has an opaque origin (no `allow-same-origin`), so its code cannot read Priors' cookies, storage or page,
 * and cannot navigate the tab. It talks to the page only through the bridge below, by `postMessage`, and the page answers only its own
 * frame. It cannot open windows either: a link goes to the page, which opens it in a new tab with no handle back (`noopener`), and only
 * right after a real click. The contract creators and their agents write against is `public/skill/benchmark-page.md`.
 */

/** Priors' colors as the frame sees them: `--priors-<name>` on its root, and `priors.theme.colors.<name>`. Value: the site's own token. */
export const EMBED_COLORS = {
  bg: "--bone", surface: "--white", text: "--ink", "text-2": "--ink-2", muted: "--grey",
  border: "--hair", "border-soft": "--hair-2", "border-strong": "--hair-3",
  accent: "--indigo", "accent-soft": "--indigo-soft", "accent-fill": "--indigo-fill", "on-accent": "--on-accent",
  good: "--good", warn: "--warn", danger: "--danger", shadow: "--shadow",
} as const;
export type EmbedColor = keyof typeof EMBED_COLORS;

/** The site's faces, loaded in the frame from Google Fonts (the page's own font files are not served to other origins). */
export const EMBED_FONTS = { sans: `"Inter", system-ui, sans-serif`, serif: `"Newsreader", Georgia, serif`, mono: `"JetBrains Mono", Menlo, monospace` } as const;
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap";

export interface EmbedTheme { mode: "light" | "dark"; colors: Record<EmbedColor, string>; fonts: typeof EMBED_FONTS }
export interface EmbedBenchmark { id: string; name: string; unit: string; higherIsBetter: boolean; url: string }
/** One leaderboard row as the frame receives it from `priors.rows()`: what the page shows, in its order. */
export interface EmbedRow {
  rank: number; model: string; modelId: string; lab: string; color?: string; effort?: string;
  /** The benchmark's own published value (a percent, an Elo, dollars). */ value: number | null;
  /** Priors' 0 to 100 score for the row. */ score: number;
  ci?: [number, number]; costUsd?: number; released?: string;
  /** The model's page on Priors; `priors.open(url)` goes there. */ url: string;
}

export const MIN_EMBED_HEIGHT = 60, MAX_EMBED_HEIGHT = 4000, DEFAULT_EMBED_HEIGHT = 320;

/** Messages between page and frame. Every one carries `priors: 1`; the page checks `event.source` is its own frame. */
export type FrameMessage = { priors: 1; type: "height"; height: number } | { priors: 1; type: "rows"; id: number } | { priors: 1; type: "open"; path: string } | { priors: 1; type: "link"; url: string };
export type PageMessage = { priors: 1; type: "theme"; theme: EmbedTheme } | { priors: 1; type: "rows"; id: number; rows: EmbedRow[] };

export function isFrameMessage(x: unknown): x is FrameMessage {
  if (!x || typeof x !== "object" || (x as { priors?: unknown }).priors !== 1) return false;
  const m = x as Record<string, unknown>;
  return (m.type === "height" && typeof m.height === "number" && Number.isFinite(m.height)) || (m.type === "rows" && typeof m.id === "number") || (m.type === "open" && typeof m.path === "string") || (m.type === "link" && typeof m.url === "string");
}

/**
 * Pages on Priors an embed may send the tab to: a model, a benchmark, a comparison. The path is parsed first and the parsed form is what
 * is checked and returned, so `..`, encoded dots or another host cannot slip past a prefix.
 */
const OPEN_PAGES = [/^\/models\/[A-Za-z0-9._:-]+$/, /^\/benchmarks\/[A-Za-z0-9._:-]+$/, /^\/compare$/];
export function safeInternalPath(path: string): string | null {
  if (path.length > 500 || !path.startsWith("/") || /[\\\s]|%2e|(^|\/)\.\.?(\/|$)/i.test(path)) return null;
  let u: URL;
  try { u = new URL(path, "https://mypriors.com"); } catch { return null; }
  if (u.origin !== "https://mypriors.com" || !OPEN_PAGES.some((re) => re.test(u.pathname)) || u.pathname.split("/").some((seg) => seg === "." || seg === "..")) return null;
  return u.pathname + u.search;
}

/** A web address an embed's link may open in a new tab: http or https only. */
export function safeExternalUrl(url: string): string | null {
  if (url.length > 2000) return null;
  try { const u = new URL(url); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
}

/** True right after a real click or key press on the page or inside one of its frames (activation reaches the page from its frames). */
export function hasUserActivation(): boolean {
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return ua ? ua.isActive : false;
}

export const clampHeight = (h: number) => Math.min(MAX_EMBED_HEIGHT, Math.max(MIN_EMBED_HEIGHT, Math.ceil(h)));

/** Reads the theme the page is showing now, from its own tokens (so site themes and custom page themes carry through). */
export function readEmbedTheme(root: HTMLElement = document.documentElement): EmbedTheme {
  const style = getComputedStyle(root);
  const colors = Object.fromEntries(Object.entries(EMBED_COLORS).map(([name, token]) => [name, style.getPropertyValue(token).trim()])) as Record<EmbedColor, string>;
  return { mode: root.dataset.theme === "dark" ? "dark" : "light", colors, fonts: EMBED_FONTS };
}

/** `:root { --priors-bg: …; … }` for a theme. Values come from the page's computed style; anything that could close the rule is dropped. */
export function themeCss(t: EmbedTheme): string {
  const clean = (v: string) => v.replace(/[;{}<>]/g, "");
  const vars = [
    ...Object.entries(t.colors).map(([k, v]) => `--priors-${k}:${clean(v)}`),
    ...Object.entries(t.fonts).map(([k, v]) => `--priors-font-${k}:${clean(v)}`),
  ];
  return `:root{${vars.join(";")};color-scheme:${t.mode}}`;
}

const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}html{background:transparent}body{margin:0;display:flow-root;background:transparent;color:var(--priors-text);font:14px/1.5 var(--priors-font-sans);-webkit-font-smoothing:antialiased}a{color:var(--priors-accent)}button,input,select,textarea{font:inherit;color:inherit}`;

/**
 * The bridge, `window.priors`, written so creators' code can rely on it before their own scripts run:
 *   priors.benchmark          { id, name, unit, higherIsBetter, url }
 *   priors.theme              { mode, colors, fonts }, kept current; also the `--priors-*` CSS variables and `html[data-theme]`
 *   priors.onTheme(fn)        called on every theme change; returns an unsubscribe function
 *   priors.rows()             Promise of the leaderboard rows the page shows (EmbedRow[]), in its order
 *   priors.open(path)         sends the tab to a Priors model, benchmark or compare page (a row's `url`), after a click
 *   priors.openLink(url)      opens a web address in a new tab, after a click (plain <a href> links do this by themselves)
 *   priors.resize()           re-measure now (the frame also follows its content's height by itself)
 * Opened on its own (no parent page), rows() answers an empty list; use `embedPreviewDocument` to test against real rows.
 */
function bridgeScript(benchmark: EmbedBenchmark, theme: EmbedTheme): string {
  const json = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");
  return `(function(){
var P=window.parent!==window?window.parent:null,themeFns=[],waiting={},seq=0,last=-1;
var priors={benchmark:${json(benchmark)},theme:${json(theme)},
onTheme:function(fn){themeFns.push(fn);return function(){themeFns=themeFns.filter(function(f){return f!==fn})}},
rows:function(){if(!P)return Promise.resolve([]);var id=++seq;return new Promise(function(res){waiting[id]=res;P.postMessage({priors:1,type:"rows",id:id},"*")})},
open:function(path){if(P)P.postMessage({priors:1,type:"open",path:String(path)},"*")},
openLink:function(url){if(P)P.postMessage({priors:1,type:"link",url:String(url)},"*")},
resize:measure};
window.priors=priors;
function applyTheme(t){priors.theme=t;var css=":root{",k;for(k in t.colors)css+="--priors-"+k+":"+String(t.colors[k]).replace(/[;{}<>]/g,"")+";";for(k in t.fonts)css+="--priors-font-"+k+":"+String(t.fonts[k]).replace(/[;{}<>]/g,"")+";";css+="color-scheme:"+t.mode+"}";var el=document.getElementById("priors-theme");if(el)el.textContent=css;document.documentElement.setAttribute("data-theme",t.mode);themeFns.slice().forEach(function(f){try{f(t)}catch(e){console.error(e)}});try{window.dispatchEvent(new CustomEvent("priors:theme",{detail:t}))}catch(e){}}
function measure(){if(!P||!document.body)return;var h=Math.ceil(document.body.getBoundingClientRect().height);if(h!==last){last=h;P.postMessage({priors:1,type:"height",height:h},"*")}}
window.addEventListener("message",function(e){if(e.source!==P)return;var m=e.data;if(!m||m.priors!==1)return;if(m.type==="theme")applyTheme(m.theme);else if(m.type==="rows"&&waiting[m.id]){waiting[m.id](m.rows);delete waiting[m.id]}});
document.addEventListener("click",function(e){if(e.defaultPrevented)return;var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a||a.hasAttribute("download"))return;var h=a.getAttribute("href");if(h.charAt(0)==="#"){e.preventDefault();var t=document.getElementById(decodeURIComponent(h.slice(1)));if(t)t.scrollIntoView({behavior:"smooth"});return}if(/^https?:/i.test(a.href)){e.preventDefault();priors.openLink(a.href)}});
function start(){measure();if(window.ResizeObserver)new ResizeObserver(measure).observe(document.body);window.addEventListener("load",measure)}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();`;
}

/**
 * The document a frame shows: the creator's HTML with Priors' head (charset, fonts, theme variables, base styles, the bridge) put in
 * front. A fragment is wrapped in a body; a full document keeps its own structure and gets the head inserted into it.
 */
export function embedDocument(html: string, opts: { benchmark: EmbedBenchmark; theme: EmbedTheme }): string {
  const head = [
    `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONT_CSS}">`,
    `<style id="priors-theme">${themeCss(opts.theme)}</style><style id="priors-base">${BASE_CSS}</style>`,
    `<script>${bridgeScript(opts.benchmark, opts.theme)}</script>`,
  ].join("");
  const mode = opts.theme.mode;
  if (/<head[\s>]/i.test(html)) return html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}${head}`).replace(/<html(\s[^>]*)?>/i, (m) => /data-theme=/i.test(m) ? m : m.replace(/>$/, ` data-theme="${mode}">`));
  if (/<html[\s>]/i.test(html)) return html.replace(/<html(\s[^>]*)?>/i, (m) => `${/data-theme=/i.test(m) ? m : m.replace(/>$/, ` data-theme="${mode}">`)}<head>${head}</head>`);
  return `<!doctype html><html lang="en" data-theme="${mode}"><head>${head}</head><body>${html}</body></html>`;
}

/**
 * The frame's permissions. No `allow-same-origin` (that would hand the frame Priors' origin), no top navigation, no popups (a window it
 * opened could reach back to this tab) and no dialogs. Links go through the page instead (`link` messages).
 */
export const EMBED_SANDBOX = "allow-scripts allow-forms allow-pointer-lock allow-downloads";
export const EMBED_ALLOW = "fullscreen; autoplay; clipboard-write; gamepad; xr-spatial-tracking";

/** The site's default light and dark tokens (`src/app/globals.css`, checked by a test), for previews made away from a page. */
export const DEFAULT_EMBED_THEMES: Record<"light" | "dark", EmbedTheme> = {
  light: { mode: "light", fonts: EMBED_FONTS, colors: { bg: "#FBFBF9", surface: "#FFFFFF", text: "#1A1A1A", "text-2": "#4A4A46", muted: "#8A8A80", border: "#DDDBD4", "border-soft": "#ECEAE3", "border-strong": "#C9C8BF", accent: "#2F4FB0", "accent-soft": "#E8ECF8", "accent-fill": "#2F4FB0", "on-accent": "#FFFFFF", good: "#2E7A3C", warn: "#A96E24", danger: "#A0403A", shadow: "rgba(26, 26, 26, .22)" } },
  dark: { mode: "dark", fonts: EMBED_FONTS, colors: { bg: "#141413", surface: "#1C1C1A", text: "#EDECE6", "text-2": "#C2C1B9", muted: "#8C8B83", border: "#34342F", "border-soft": "#242422", "border-strong": "#4A4A44", accent: "#9AABF5", "accent-soft": "#1F2643", "accent-fill": "#3E5BC2", "on-accent": "#FFFFFF", good: "#7CC68A", warn: "#E6B464", danger: "#F0907F", shadow: "rgba(0, 0, 0, .55)" } },
};

/**
 * A standalone page for checking an embed before it goes live: the creator's HTML in the real wrapper, on the site's background, with
 * the benchmark's real leaderboard rows built in and a light/dark switch that drives the bridge exactly as the page does.
 */
export function embedPreviewDocument(html: string, opts: { benchmark: EmbedBenchmark; rows: EmbedRow[]; mode?: "light" | "dark" }): string {
  const mode = opts.mode ?? "light", theme = DEFAULT_EMBED_THEMES[mode];
  const inner = embedDocument(html, { benchmark: opts.benchmark, theme });
  const json = (x: unknown) => JSON.stringify(x).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Preview · ${opts.benchmark.name.replace(/[<&]/g, "")}</title>
<style>body{margin:0;padding:24px;font:13px system-ui;transition:background .2s}header{display:flex;gap:12px;align-items:center;margin-bottom:16px}iframe{display:block;width:100%;max-width:1036px;border:0;height:320px}</style></head>
<body><header><strong>Embed preview</strong><button id="mode">Switch light/dark</button><span id="h"></span></header>
<iframe id="f" sandbox="${EMBED_SANDBOX}" allow="${EMBED_ALLOW}" allowfullscreen></iframe>
<script>var themes=${json(DEFAULT_EMBED_THEMES)},rows=${json(opts.rows)},mode=${json(mode)},f=document.getElementById("f");
f.srcdoc=${json(inner)};
function paint(){var t=themes[mode];document.body.style.background=t.colors.bg;document.body.style.color=t.colors.text;document.documentElement.style.colorScheme=mode}paint();
document.getElementById("mode").onclick=function(){mode=mode==="light"?"dark":"light";paint();f.contentWindow.postMessage({priors:1,type:"theme",theme:themes[mode]},"*")};
addEventListener("message",function(e){if(e.source!==f.contentWindow||!e.data||e.data.priors!==1)return;var m=e.data;
if(m.type==="height"){var h=Math.min(${MAX_EMBED_HEIGHT},Math.max(${MIN_EMBED_HEIGHT},Math.ceil(m.height)));f.style.height=h+"px";document.getElementById("h").textContent="height "+h+"px"}
else if(m.type==="rows")f.contentWindow.postMessage({priors:1,type:"rows",id:m.id,rows:rows},"*");
else if(m.type==="open")document.getElementById("h").textContent="would open https://mypriors.com"+m.path;
else if(m.type==="link"&&/^https?:/i.test(m.url))window.open(m.url,"_blank","noopener,noreferrer")});</script></body></html>`;
}
