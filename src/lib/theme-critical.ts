/**
 * Inline in <head>, so it applies before any stylesheet loads: a visitor whose system is dark gets a dark
 * page from the first paint, never a white flash while CSS or the theme script is still on its way. It stops
 * applying once the script sets data-theme. The color is the dark `--bone` in globals.css (a test keeps them equal).
 */
export const THEME_CRITICAL_CSS = "@media (prefers-color-scheme: dark){html:not([data-theme]){background:#141413;color-scheme:dark}}";
