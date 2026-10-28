import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

/** Links at or under this many characters are copied as they are. */
export const SHORTEN_OVER = 300;
const TIMEOUT_MS = 4000;

/** The same-origin path (pathname + search + hash) of a link long enough to shorten, else null. */
export function pathToShorten(url: string, origin: string, threshold = SHORTEN_OVER): string | null {
  if (url.length <= threshold) return null;
  let parsed: URL;
  try { parsed = new URL(url, origin); } catch { return null; }
  if (parsed.origin !== origin) return null;
  const path = parsed.pathname + parsed.search + parsed.hash;
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

export const shortUrl = (origin: string, slug: string) => `${origin}/s/${slug}`;

const cache = new Map<string, Promise<string>>();
let client: ConvexHttpClient | null = null;

/**
 * A short `/s/<slug>` link for a long same-origin one. Returns the link unchanged when it is already short, belongs to
 * another origin, there is no backend, or the call fails or runs slow: copying never waits on this for long or fails.
 */
export function shortenUrl(url: string): Promise<string> {
  if (typeof window === "undefined") return Promise.resolve(url);
  const path = pathToShorten(url, window.location.origin);
  const convex = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!path || !convex) return Promise.resolve(url);
  const hit = cache.get(path);
  if (hit) return hit;
  client ??= new ConvexHttpClient(convex);
  const origin = window.location.origin;
  const made = Promise.race([
    client.mutation(api.shortLinks.create, { path }).then((slug) => shortUrl(origin, slug)),
    new Promise<string>((resolve) => setTimeout(() => resolve(url), TIMEOUT_MS)),
  ]).catch(() => url);
  cache.set(path, made);
  // Only keep successes: a failure or timeout should be retried on the next copy.
  void made.then((result) => { if (result === url) cache.delete(path); });
  return made;
}

/**
 * Copies a page or chart link, shortened when it is long. Call it straight from the click handler: Safari drops clipboard
 * permission across an await, so a long link is handed to the clipboard as a pending blob. Rejects only when the clipboard does.
 */
export async function copyLink(url: string): Promise<void> {
  const long = typeof window !== "undefined" && pathToShorten(url, window.location.origin) !== null;
  if (!long) return navigator.clipboard.writeText(url);
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    const text = shortenUrl(url).then((short) => new Blob([short], { type: "text/plain" }));
    try { await navigator.clipboard.write([new ClipboardItem({ "text/plain": text })]); return; } catch { /* fall back below */ }
  }
  await navigator.clipboard.writeText(await shortenUrl(url));
}
