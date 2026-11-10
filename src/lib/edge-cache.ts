const SHARED_MAX_AGE = /(?:^|[,\s])s-maxage=(\d+)/i, STALE = /stale-while-revalidate=(\d+)/i;

/** Pages rendered the same for every anonymous visitor. Their HTML goes through the edge too; the rest answers to its own cache headers. */
const PAGES = /^\/(?:builder|explore|model-finder|benchmarks(?:\/[^/]+)?|models\/[^/]+|compare|cli|history|privacy|support|skill|tools|request|3d)?$/;
const PAGE_FRESH = 60, PAGE_STALE = 3600;
/** Who needs their own render: a saved mix or a session changes the page, and bots get a different body (link-preview.tsx). */
const PERSONAL_COOKIE = /(?:^|;\s*)(?:priors(?:%3A|:)mix|__session|__client_uat=(?!0(?:;|$)))/i;
const BOT = /twitterbot|facebookexternalhit|facebot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|applebot|redditbot|embedly|skypeuripreview|iframely|bluesky|cardyb|mastodon|pinterest|vkshare|googlebot|bingbot|duckduckbot|yandex|baiduspider/i;
const BROWSER = /applewebkit|gecko\/|chrome\/|safari\/|firefox\//i;

export function cachesPage(request: Request): boolean {
  const ua = request.headers.get("user-agent") ?? "", url = new URL(request.url);
  // A client navigation's response depends on its router headers, so only plain document requests share a copy.
  if (request.headers.has("rsc") || url.searchParams.has("_rsc")) return false;
  return PAGES.test(url.pathname) && !BOT.test(ua) && BROWSER.test(ua) && !PERSONAL_COOKIE.test(request.headers.get("cookie") ?? "");
}

/** s-maxage and stale-while-revalidate are only for the edge, as on Vercel; a page stays uncacheable in the browser. */
function forVisitor(response: Response, state: "hit" | "stale" | "miss"): Response {
  const visitor = new Response(response.body, response);
  const control = (response.headers.get("x-priors-page") ? "private, no-cache" : (response.headers.get("cache-control") ?? "").split(",").map((part) => part.trim()).filter((part) => !/^(s-maxage|stale-while-revalidate)=/i.test(part)).join(", "));
  visitor.headers.set("cache-control", control);
  visitor.headers.delete("x-priors-stored");
  visitor.headers.delete("x-priors-page");
  visitor.headers.set("x-priors-edge", state);
  return visitor;
}

/** The browser already holds this version: answer without the body. */
function revalidated(request: Request, response: Response): Response {
  const tag = response.headers.get("etag");
  return tag && request.headers.get("if-none-match") === tag ? new Response(null, { status: 304, headers: response.headers }) : response;
}

/** A copy for the Cache API, or nothing when the response isn't shareable. `fresh` seconds serve as they are, `stale` more serve while a new copy is fetched. */
function storable(response: Response, page: boolean, build: string): { copy: Response } | undefined {
  if (!response.ok || response.headers.has("set-cookie")) return undefined;
  const control = response.headers.get("cache-control") ?? "";
  const fresh = page ? PAGE_FRESH : Number(control.match(SHARED_MAX_AGE)?.[1]), stale = page ? PAGE_STALE : Number(control.match(STALE)?.[1] ?? 0);
  if (!fresh || (!page && !/\bpublic\b/i.test(control))) return undefined;
  const copy = new Response(response.clone().body, response);
  copy.headers.set("cache-control", `public, s-maxage=${fresh + stale}`);
  copy.headers.set("x-priors-stored", `${Date.now()},${fresh},${build}`);
  if (page) copy.headers.set("x-priors-page", "1");
  else copy.headers.set("x-priors-control", control);
  return { copy };
}

/**
 * A tiny front Worker answers these without starting the app Worker, whose 27 MB bundle takes over a second to load
 * in a cold isolate. Routes asking for shared caching (`public, s-maxage=n`) and anonymous page HTML go through the
 * Cache API. Past its fresh window a copy still serves while `defer` fetches the next one.
 */
export async function edgeCached(request: Request, cache: Cache, defer: (work: Promise<unknown>) => void, origin: () => Promise<Response>, build = "dev", now = Date.now()): Promise<Response> {
  if (request.method !== "GET" || request.headers.has("authorization")) return origin();
  const url = new URL(request.url);
  if (url.pathname.startsWith("/ingest") || url.pathname.startsWith("/_next/")) return origin();
  const page = cachesPage(request);
  const key = new Request(url.href);
  const update = async () => {
    const response = await origin();
    const stored = storable(response, page, build);
    if (stored) await cache.put(key, stored.copy);
    return { response, stored: !!stored };
  };
  const hit = await cache.match(key);
  if (hit) {
    const [at, fresh, from] = (hit.headers.get("x-priors-stored") ?? "").split(",");
    const original = hit.headers.get("x-priors-control");
    const isPage = hit.headers.has("x-priors-page");
    // The same address can answer a page visitor and a bot: only a page visitor gets stored page HTML.
    if (from === build && (!isPage || page)) {
      const visitor = new Response(hit.body, hit);
      if (original) { visitor.headers.set("cache-control", original); visitor.headers.delete("x-priors-control"); }
      const age = (now - Number(at)) / 1000;
      if (age < Number(fresh)) return revalidated(request, forVisitor(visitor, "hit"));
      defer(update().catch(() => undefined));
      return revalidated(request, forVisitor(visitor, "stale"));
    }
  }
  const { response, stored } = await update();
  if (!stored) return response;
  if (page) { const v = new Response(response.body, response); v.headers.set("x-priors-page", "1"); return forVisitor(v, "miss"); }
  return forVisitor(response, "miss");
}
