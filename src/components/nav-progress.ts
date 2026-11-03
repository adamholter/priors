let leavingSince = 0;
const LEAVING_MS = 12_000;
/** Between a link's click and its page arriving. A `history.replaceState` in that window makes the router drop the navigation, so a click just after an edit did nothing. */
export const leaving = () => Date.now() - leavingSince < LEAVING_MS;
export const markLeaving = (on: boolean) => { leavingSince = on ? Date.now() : 0; };

/**
 * Whether clicking this link starts a page change the visitor has to wait for. Modified clicks open elsewhere, and a
 * same-page link (only a new query or hash) changes nothing that needs a wait. The wordmark's "/" sends a returning
 * visitor straight back to /builder, so from there it never arrives at a new path.
 */
export function startsNavigation(link: { href: string; target?: string; download?: boolean }, click: { button: number; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean }, here: string): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if ((link.target && link.target !== "_self") || link.download) return false;
  const from = new URL(here);
  let to: URL;
  try { to = new URL(link.href, here); } catch { return false; }
  if (to.origin !== from.origin || to.pathname === from.pathname) return false;
  // Not client routes: the API, images and the like load on their own.
  if (/^\/(?:api|og|ingest)(?:\/|$)/.test(to.pathname)) return false;
  return !(to.pathname === "/" && from.pathname === "/builder");
}
