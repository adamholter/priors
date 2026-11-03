import { describe, expect, it, vi } from "vitest";
import { cachesPage, edgeCached } from "./edge-cache";

const CHROME = "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140 Safari/537.36";
function setup(control: string | null, { cookie = false, body = "body" } = {}) {
  const items = new Map<string, Response>(), work: Promise<unknown>[] = [];
  const cache = { match: async (k: Request) => items.get(k.url)?.clone(), put: async (k: Request, r: Response) => { items.set(k.url, r); } } as unknown as Cache;
  const origin = vi.fn(async () => { const h = new Headers(control ? { "cache-control": control } : {}); if (cookie) h.set("set-cookie", "a=1"); return new Response(body, { headers: h }); });
  const go = (url: string, init: RequestInit = {}, opts: { build?: string; now?: number } = {}) => edgeCached(new Request(url, { ...init, headers: { "user-agent": CHROME, ...(init.headers as object) } }), cache, (w) => work.push(w), origin, opts.build ?? "b1", opts.now ?? Date.now());
  return { items, work, origin, go };
}

describe("edgeCached", () => {
  it("serves a route asking for shared caching from the cache the second time, with the browser's header unchanged", async () => {
    const t = setup("public, max-age=300, s-maxage=1800");
    const first = await t.go("https://x.test/api/history");
    await Promise.all(t.work);
    expect(first.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await first.text()).toBe("body");
    const second = await t.go("https://x.test/api/history");
    expect(second.headers.get("x-priors-edge")).toBe("hit");
    expect(second.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await second.text()).toBe("body");
    expect(t.origin).toHaveBeenCalledTimes(1);
  });

  it("serves an anonymous page from the edge and never lets the browser keep it", async () => {
    const t = setup("private, no-cache, no-store");
    expect((await t.go("https://x.test/builder")).headers.get("x-priors-edge")).toBe("miss");
    const second = await t.go("https://x.test/builder");
    expect(second.headers.get("x-priors-edge")).toBe("hit");
    expect(second.headers.get("cache-control")).toBe("private, no-cache");
    expect(t.origin).toHaveBeenCalledTimes(1);
  });

  it("past the fresh window serves the stored copy and fetches the next one behind it", async () => {
    const t = setup("private, no-store"), start = Date.now();
    await t.go("https://x.test/models/a", {}, { now: start });
    const later = await t.go("https://x.test/models/a", {}, { now: start + 120_000 });
    expect(later.headers.get("x-priors-edge")).toBe("stale");
    await Promise.all(t.work);
    expect(t.origin).toHaveBeenCalledTimes(2);
  });

  it("does not serve a copy from an earlier deploy, whose chunks may be gone", async () => {
    const t = setup("private, no-store");
    await t.go("https://x.test/builder", {}, { build: "b1" });
    expect((await t.go("https://x.test/builder", {}, { build: "b2" })).headers.get("x-priors-edge")).toBe("miss");
    expect(t.origin).toHaveBeenCalledTimes(2);
  });

  it("leaves pages alone for a saved mix, a session or a bot, and bots never get stored page HTML", async () => {
    const t = setup("private, no-store");
    await t.go("https://x.test/builder");
    for (const headers of [{ cookie: "priors%3Amix=abc" }, { cookie: "priors:mix=abc" }, { cookie: "__session=x" }, { cookie: "__client_uat=17" }, { "user-agent": "Twitterbot/1.0" }, { "user-agent": "Mozilla/5.0" }, { "user-agent": "Googlebot/2.1" }]) {
      const r = await t.go("https://x.test/builder", { headers: headers as unknown as HeadersInit });
      expect(r.headers.get("x-priors-edge")).toBeNull();
    }
    expect(t.origin).toHaveBeenCalledTimes(8);
  });

  it("a signed-out Clerk cookie and the theme cookie still share the page", () => {
    const req = (cookie: string) => new Request("https://x.test/builder", { headers: { "user-agent": CHROME, cookie } });
    expect(cachesPage(req("__client_uat=0; priors_theme=dark"))).toBe(true);
    expect(cachesPage(new Request("https://x.test/rank", { headers: { "user-agent": CHROME } }))).toBe(false);
    expect(cachesPage(new Request("https://x.test/builder", { headers: { "user-agent": CHROME, rsc: "1" } }))).toBe(false);
    expect(cachesPage(new Request("https://x.test/builder?_rsc=a1", { headers: { "user-agent": CHROME, rsc: "1" } }))).toBe(false);
    expect(cachesPage(new Request("https://x.test/builder?_rsc=a1", { headers: { "user-agent": CHROME } }))).toBe(false);
  });

  it.each([
    ["no shared cache header", "https://x.test/api/thing", "private, no-store", {}, false],
    ["no header at all", "https://x.test/api/thing", null, {}, false],
    ["a response that sets a cookie", "https://x.test/og", "public, s-maxage=60", {}, true],
    ["a signed-in request", "https://x.test/og", "public, s-maxage=60", { headers: { authorization: "Bearer t" } }, false],
    ["a POST", "https://x.test/mcp", "public, s-maxage=60", { method: "POST" }, false],
    ["analytics", "https://x.test/ingest/e", "public, s-maxage=60", {}, false],
  ] as const)("never stores %s", async (_name, url, control, init, cookie) => {
    const t = setup(control, { cookie });
    await t.go(url, init as RequestInit);
    await Promise.all(t.work);
    expect(t.items.size).toBe(0);
  });
});
