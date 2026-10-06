/**
 * Same-origin PostHog proxy (/ingest/* → PostHog US) so blockers don't drop analytics.
 * A route handler rather than a rewrite: rewrites forward every request header, including the
 * Clerk session cookie. Only the headers PostHog needs are passed through.
 */
const FORWARD = ["content-type", "content-encoding", "user-agent", "accept", "accept-language", "origin", "referer"];

async function proxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const host = path[0] === "static" ? "https://us-assets.i.posthog.com" : "https://us.i.posthog.com";
  const url = new URL(req.url);
  const target = `${host}/${path.map(encodeURIComponent).join("/")}${url.pathname.endsWith("/") ? "/" : ""}${url.search}`;
  const headers = new Headers();
  for (const key of FORWARD) { const value = req.headers.get(key); if (value) headers.set(key, value); }
  // PostHog geolocates from the client IP; the cookie header is deliberately not forwarded.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  if (ip) headers.set("x-forwarded-for", ip);
  const res = await fetch(target, { method: req.method, headers, body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(), redirect: "manual" });
  const out = new Headers();
  for (const key of ["content-type", "cache-control", "etag", "last-modified"]) { const value = res.headers.get(key); if (value) out.set(key, value); }
  return new Response(req.method === "HEAD" ? null : res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as HEAD, proxy as OPTIONS };
