import { describe, expect, it, vi } from "vitest";
import { edgeCached } from "./edge-cache";

function fakeCache() {
  const items = new Map<string, Response>();
  return { items, cache: { match: async (k: Request) => items.get(k.url)?.clone(), put: async (k: Request, r: Response) => { items.set(k.url, r); } } as unknown as Cache };
}
const run = (url: string, control: string | null, init: RequestInit = {}, cookie = false) => {
  const { items, cache } = fakeCache(), work: Promise<unknown>[] = [];
  const headers = new Headers(control ? { "cache-control": control } : {});
  if (cookie) headers.set("set-cookie", "a=1");
  const origin = vi.fn(async () => new Response("body", { headers }));
  return { items, cache, work, origin, go: () => edgeCached(new Request(url, init), cache, (w) => work.push(w), origin) };
};

describe("edgeCached", () => {
  it("serves a route that asks for shared caching from the cache the second time, without s-maxage for the browser", async () => {
    const t = run("https://x.test/api/history", "public, max-age=300, s-maxage=1800");
    const first = await t.go();
    await Promise.all(t.work);
    expect(first.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await first.text()).toBe("body");
    const second = await t.go();
    expect(await second.text()).toBe("body");
    expect(second.headers.get("cache-control")).toBe("public, max-age=300");
    expect(t.origin).toHaveBeenCalledTimes(1);
  });

  it("keeps s-maxage out of what the browser sees alongside stale-while-revalidate", async () => {
    const t = run("https://x.test/og", "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800");
    expect((await t.go()).headers.get("cache-control")).toBe("public, max-age=600");
  });

  it.each([
    ["no shared cache header", "https://x.test/", "private, no-store", {}, false],
    ["no header at all", "https://x.test/", null, {}, false],
    ["a response that sets a cookie", "https://x.test/og", "public, s-maxage=60", {}, true],
    ["a signed-in request", "https://x.test/og", "public, s-maxage=60", { headers: { authorization: "Bearer t" } }, false],
    ["a POST", "https://x.test/mcp", "public, s-maxage=60", { method: "POST" }, false],
  ] as const)("never stores %s", async (_name, url, control, init, cookie) => {
    const t = run(url, control, init as RequestInit, cookie);
    await t.go();
    await Promise.all(t.work);
    expect(t.items.size).toBe(0);
  });
});
