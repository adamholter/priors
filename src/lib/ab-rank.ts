/**
 * A/B test, started 2026-11-27: where "Rank models" lives. Half of visitors ("header") get it in the site header as before; half ("corner")
 * get it as a floating button in the bottom-right corner instead, out of the header. Rank models feeds PriorsBench, so the question is
 * whether moving it costs (or gains) rankings.
 *
 * The variant is picked before first paint by `RANK_AB_SCRIPT` (root layout <head>), kept in localStorage, and written to
 * `<html data-rank-place>`; CSS shows one placement or the other (globals.css, `.rank-in-header` and `.rank-float`), so neither flickers.
 * `?rankplace=header|corner` forces a variant (and keeps it), for checking. Automated browsers (`navigator.webdriver`) see "header" without
 * being assigned, so the e2e checks are stable and bots stay out of the split. Every PostHog event carries `rank_placement` (analytics.ts
 * registers it), and clicks on either placement send `rank_cta_clicked` with where it was clicked.
 */
export const RANK_AB_KEY = "priors-ab-rank";
export type RankPlacement = "header" | "corner";
export const RANK_AB_SCRIPT = `(function(){var k="${RANK_AB_KEY}",v,q;try{q=new URLSearchParams(location.search).get("rankplace")}catch(e){}try{v=localStorage.getItem(k)}catch(e){}if(q==="header"||q==="corner")v=q;if(v!=="header"&&v!=="corner"){if(navigator.webdriver){document.documentElement.dataset.rankPlace="header";return}v=Math.random()<0.5?"header":"corner"}try{localStorage.setItem(k,v)}catch(e){}document.documentElement.dataset.rankPlace=v})()`;

/** The variant this visitor sees (read from the page, which the head script set). */
export function rankPlacement(): RankPlacement | undefined {
  if (typeof document === "undefined") return undefined;
  const v = document.documentElement.dataset.rankPlace;
  return v === "header" || v === "corner" ? v : undefined;
}
