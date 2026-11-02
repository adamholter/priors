const SHARED_MAX_AGE = /(?:^|[,\s])s-maxage=(\d+)/i;

/** s-maxage and stale-while-revalidate are only for the edge, as on Vercel. */
function forVisitor(response: Response): Response {
  const visitor = new Response(response.body, response);
  visitor.headers.set("cache-control", (response.headers.get("cache-control") ?? "").split(",").map((part) => part.trim()).filter((part) => !/^(s-maxage|stale-while-revalidate)=/i.test(part)).join(", "));
  return visitor;
}

/**
 * Workers has no CDN in front of a Worker's own responses, so routes that ask for shared caching (`public, s-maxage=n`)
 * go through the Cache API here. Without it every card and history request would render again.
 */
export async function edgeCached(request: Request, cache: Cache, defer: (work: Promise<unknown>) => void, origin: () => Promise<Response>): Promise<Response> {
  if (request.method !== "GET" || request.headers.has("authorization")) return origin();
  const key = new Request(request.url);
  const hit = await cache.match(key);
  if (hit) return forVisitor(hit);
  const response = await origin();
  const control = response.headers.get("cache-control") ?? "";
  if (!response.ok || !Number(control.match(SHARED_MAX_AGE)?.[1]) || !/\bpublic\b/i.test(control) || response.headers.has("set-cookie")) return response;
  defer(cache.put(key, response.clone()));
  return forVisitor(response);
}
