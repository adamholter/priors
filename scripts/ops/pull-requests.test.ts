import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newSince, pullAll, readPrevious, scrub, summary } from "./pull-requests.mjs";

const row = (id: string, createdAt: number, status = "new") => ({ id, kind: "benchmark", text: `request ${id}`, createdAt, status });

describe("diffing against the previous file", () => {
  it("counts requests the previous file did not hold, by id", () => {
    const previous = [row("b", 2), row("a", 1)], current = [row("d", 4), row("c", 3), row("b", 2, "seen"), row("a", 1)];
    expect(newSince(previous, current).map((r: { id: string }) => r.id)).toEqual(["d", "c"]);
    expect(newSince(current, current)).toEqual([]);
    expect(newSince(null, current)).toHaveLength(4);
  });
  it("prints one line", () => {
    expect(summary([row("a", 1)], [row("b", 2), row("a", 1)])).toBe("2 requests, 1 new since the previous file");
    expect(summary(null, [row("a", 1)])).toBe("1 request, 1 new (no previous file)");
    expect(summary([], [])).toBe("0 requests, 0 new since the previous file");
  });
  it("reads no file as a first run and refuses a file that is not a list", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "priors-requests-"));
    expect(readPrevious(path.join(dir, "none.json"))).toBeNull();
    writeFileSync(path.join(dir, "broken.json"), "{ not json");
    expect(() => readPrevious(path.join(dir, "broken.json"))).toThrow(/not valid JSON/);
    writeFileSync(path.join(dir, "object.json"), "{}");
    expect(() => readPrevious(path.join(dir, "object.json"))).toThrow(/not a list/);
  });
});

describe("pullAll", () => {
  it("pages older until a short page, without losing or repeating a request", async () => {
    // Two requests share a millisecond across the page boundary.
    const all = [row("f", 60), row("e", 50), row("d", 40), row("c", 40), row("b", 20), row("a", 10)];
    const asked: (number | undefined)[] = [];
    const got = await pullAll(async (before: number | undefined) => { asked.push(before); return all.filter((r) => before === undefined || r.createdAt < before).slice(0, 3); }, 3);
    expect(got.map((r: { id: string }) => r.id)).toEqual(["f", "e", "d", "c", "b", "a"]);
    expect(asked).toEqual([undefined, 41, 21]);
  });
  it("stops on an empty list and refuses anything that is not one", async () => {
    expect(await pullAll(async () => [])).toEqual([]);
    await expect(pullAll(async () => ({ nope: true }))).rejects.toThrow(/did not return a list/);
  });
});

it("scrub cuts the token out of a message", () => {
  expect(scrub("bad token tok_abc in tok_abc", "tok_abc")).toBe("bad token [token] in [token]");
  expect(scrub("plain", "")).toBe("plain");
});

describe("the script, against a stand-in for Convex's HTTP API", () => {
  const TOKEN = "tok_test_0123456789abcdef";
  let server: Server, base = "", stored = [row("b", 2), row("a", 1)];
  const bodies: { path: string; args: { token: string }; format: string }[] = [];
  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => { raw += c; });
      req.on("end", () => {
        const body = JSON.parse(raw); bodies.push(body);
        res.setHeader("content-type", "application/json");
        if (req.url !== "/api/query" || body.path !== "requests:list") { res.statusCode = 404; return res.end("{}"); }
        // What Convex answers when the function throws ConvexError("forbidden").
        if (body.args.token !== TOKEN) return res.end(JSON.stringify({ status: "error", errorMessage: "Uncaught ConvexError: forbidden", errorData: "forbidden" }));
        res.end(JSON.stringify({ status: "success", value: stored }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => { server.close(() => r()); }));
  // The child sees only the variables a case names, whatever this shell has set.
  const { PRIORS_REQUESTS_TOKEN: _t, PRIORS_CONVEX_URL: _u, NEXT_PUBLIC_CONVEX_URL: _n, ...clean } = process.env; void _t; void _u; void _n;
  const run = (args: string[], env: Record<string, string>) => new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    execFile(process.execPath, [path.resolve(__dirname, "pull-requests.mjs"), ...args], { env: { ...clean, ...env }, encoding: "utf8" }, (error, stdout, stderr) => resolve({ code: error ? Number(error.code ?? 1) : 0, stdout, stderr }));
  });

  it("writes the list, creates the directory, and counts what is new on the next run", async () => {
    const out = path.join(mkdtempSync(path.join(tmpdir(), "priors-requests-")), "nested", "dir", "requests.json");
    const first = await run([out], { PRIORS_REQUESTS_TOKEN: TOKEN, PRIORS_CONVEX_URL: `${base}/` });
    expect(first).toMatchObject({ code: 0, stdout: "2 requests, 2 new (no previous file)\n", stderr: "" });
    expect(JSON.parse(readFileSync(out, "utf8"))).toEqual(stored);
    expect(bodies.at(-1)).toMatchObject({ path: "requests:list", format: "json", args: { token: TOKEN } });
    stored = [row("c", 3), ...stored];
    // The fallback variable works, and the first one wins when both are set.
    const second = await run([out], { PRIORS_REQUESTS_TOKEN: TOKEN, NEXT_PUBLIC_CONVEX_URL: base });
    expect(second).toMatchObject({ code: 0, stdout: "3 requests, 1 new since the previous file\n" });
    expect(JSON.parse(readFileSync(out, "utf8")).map((r: { id: string }) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("exits 1 with a clear message, prints no token, and leaves the previous file alone", async () => {
    const out = path.join(mkdtempSync(path.join(tmpdir(), "priors-requests-")), "requests.json");
    writeFileSync(out, "[]\n");
    const wrong = "tok_wrong_fedcba9876543210";
    const cases: [string[], Record<string, string>, RegExp][] = [
      [[out], { PRIORS_REQUESTS_TOKEN: wrong, PRIORS_CONVEX_URL: base }, /token was refused/],
      [[out], { PRIORS_CONVEX_URL: base }, /PRIORS_REQUESTS_TOKEN is not set/],
      [[out], { PRIORS_REQUESTS_TOKEN: wrong }, /PRIORS_CONVEX_URL is not set/],
      [[], { PRIORS_REQUESTS_TOKEN: wrong, PRIORS_CONVEX_URL: base }, /usage/],
      [[out], { PRIORS_REQUESTS_TOKEN: wrong, PRIORS_CONVEX_URL: "http://127.0.0.1:1" }, /pull-requests: /],
    ];
    for (const [args, env, message] of cases) {
      const r = await run(args, env);
      expect(r.code, String(message)).toBe(1);
      expect(r.stderr).toMatch(message);
      expect(r.stdout).toBe("");
      expect(r.stdout + r.stderr).not.toContain(wrong);
    }
    expect(readFileSync(out, "utf8")).toBe("[]\n");
  });
});
