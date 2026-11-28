import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCK_LIMITS, checkBlocks } from "../../convex/benchmarkPageRules";
import { clampHeight, DEFAULT_EMBED_THEMES, EMBED_COLORS, EMBED_SANDBOX, embedDocument, embedPreviewDocument, isFrameMessage, safeExternalUrl, safeInternalPath, themeCss } from "./benchmark-embed";

const benchmark = { id: "spectrobench", name: "SpectroBench", unit: "score", higherIsBetter: true, url: "https://spectrobench.ssh.codes" };
const theme = DEFAULT_EMBED_THEMES.light;

describe("checkBlocks", () => {
  it("keeps stored fields only and trims text", () => {
    const r = checkBlocks([{ id: "player", kind: "embed", html: "<p>hi</p>", title: "  Listen  ", placement: "below", extra: 1, body: "dropped" }, { id: "note", kind: "text", body: "  Hello\nthere ", hidden: true }]);
    expect(r).toEqual({ ok: true, blocks: [{ id: "player", kind: "embed", html: "<p>hi</p>", title: "Listen" }, { id: "note", kind: "text", body: "Hello\nthere", hidden: true }] });
  });
  it("refuses bad ids, duplicates, kinds and missing content with messages an agent can act on", () => {
    expect(checkBlocks([{ id: "Bad Id", kind: "text", body: "x" }])).toMatchObject({ ok: false, error: expect.stringMatching(/lowercase/) });
    expect(checkBlocks([{ id: "a", kind: "text", body: "x" }, { id: "a", kind: "text", body: "y" }])).toMatchObject({ ok: false, error: expect.stringMatching(/Two blocks/) });
    expect(checkBlocks([{ id: "a", kind: "script", body: "x" }])).toMatchObject({ ok: false });
    expect(checkBlocks([{ id: "a", kind: "embed" }])).toMatchObject({ ok: false, error: expect.stringMatching(/needs html/) });
    expect(checkBlocks("nope")).toMatchObject({ ok: false });
  });
  it("enforces the size, count and height limits", () => {
    expect(checkBlocks([{ id: "a", kind: "embed", html: "x".repeat(BLOCK_LIMITS.html + 1) }])).toMatchObject({ ok: false, error: expect.stringMatching(/own host/) });
    expect(checkBlocks(Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, kind: "embed", html: "x".repeat(BLOCK_LIMITS.html) })))).toMatchObject({ ok: false, error: expect.stringMatching(/page limit/) });
    expect(checkBlocks(Array.from({ length: BLOCK_LIMITS.blocks + 1 }, (_, i) => ({ id: `b${i}`, kind: "text", body: "x" })))).toMatchObject({ ok: false });
    expect(checkBlocks([{ id: "a", kind: "embed", html: "x", height: 10 }])).toMatchObject({ ok: false });
    expect(checkBlocks([{ id: "a", kind: "embed", html: "x", height: 480.4 }])).toEqual({ ok: true, blocks: [{ id: "a", kind: "embed", html: "x", height: 480 }] });
    expect(checkBlocks([])).toEqual({ ok: true, blocks: [] });
  });
});

describe("embedDocument", () => {
  it("wraps a fragment with the theme, base styles and bridge before the creator's HTML", () => {
    const doc = embedDocument("<canvas id=c></canvas>", { benchmark, theme: DEFAULT_EMBED_THEMES.dark });
    expect(doc.startsWith('<!doctype html><html lang="en" data-theme="dark"><head>')).toBe(true);
    expect(doc).toContain("--priors-accent:#9AABF5");
    expect(doc).toContain("window.priors=priors");
    expect(doc.indexOf("window.priors")).toBeLessThan(doc.indexOf("<canvas"));
    expect(doc.endsWith("<body><canvas id=c></canvas></body></html>")).toBe(true);
  });
  it("puts the head inside a full document instead of nesting documents", () => {
    const doc = embedDocument('<!doctype html><html class="x"><head><title>t</title></head><body>b</body></html>', { benchmark, theme });
    expect(doc.match(/<html/g)).toHaveLength(1);
    expect(doc).toContain('<html class="x" data-theme="light"><head><meta charset="utf-8">');
    expect(doc.indexOf("window.priors")).toBeLessThan(doc.indexOf("<title>"));
    const bare = embedDocument("<html><body>b</body></html>", { benchmark, theme });
    expect(bare).toMatch(/^<html data-theme="light"><head><meta charset/);
  });
  it("cannot be broken out of by data: names and token values are escaped", () => {
    const doc = embedDocument("x", { benchmark: { ...benchmark, name: "</script><script>alert(1)</script>" }, theme: { ...theme, colors: { ...theme.colors, accent: "red}</style><script>" } } });
    expect(doc).not.toContain("</script><script>alert(1)");
    expect(themeCss({ ...theme, colors: { ...theme.colors, accent: "red;}body{x" } })).toContain("--priors-accent:redbodyx");
  });
  it("never grants the frame Priors' origin or top navigation", () => {
    expect(EMBED_SANDBOX).toContain("allow-scripts");
    expect(EMBED_SANDBOX).not.toMatch(/allow-same-origin|allow-top-navigation|allow-popups|allow-modals/);
  });
  it("makes a standalone preview that runs the same bridge against real rows", () => {
    const doc = embedPreviewDocument("<p>hi</p>", { benchmark, rows: [{ rank: 1, model: "M", modelId: "m", lab: "L", value: 71.4, score: 100, url: "/models/m" }], mode: "dark" });
    expect(doc).toContain(`sandbox="${EMBED_SANDBOX}"`);
    expect(doc).toContain('"value":71.4');
    expect(doc).toContain("f.srcdoc=");
  });
});

describe("frame messages", () => {
  it("accepts only well-formed bridge messages", () => {
    expect(isFrameMessage({ priors: 1, type: "height", height: 300 })).toBe(true);
    expect(isFrameMessage({ priors: 1, type: "height", height: Infinity })).toBe(false);
    expect(isFrameMessage({ type: "height", height: 3 })).toBe(false);
    expect(isFrameMessage({ priors: 1, type: "eval", code: "x" })).toBe(false);
  });
  it("opens only model, benchmark and compare pages on Priors", () => {
    expect(safeInternalPath("/models/gpt-6.2-astra")).toBe("/models/gpt-6.2-astra");
    expect(safeInternalPath("/benchmarks/spectrobench")).toBe("/benchmarks/spectrobench");
    expect(safeInternalPath("/compare?a=gpt-6.2-astra&b=claude-fable-5.2")).toBe("/compare?a=gpt-6.2-astra&b=claude-fable-5.2");
    for (const bad of ["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "models/x", "/sign-in", "/adamholter?edit=1", "/api/agent",
      "/models/../sign-in", "/models/%2e%2e/sign-in", "/benchmarks/./x/../../api", "/compare-evil", "/compare/../sign-in", "/models/a/b", "/models/x#y z"]) expect(safeInternalPath(bad), bad).toBeNull();
  });
  it("opens only http and https links", () => {
    expect(safeExternalUrl("https://spectrobench.ssh.codes/a")).toBe("https://spectrobench.ssh.codes/a");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "not a url"]) expect(safeExternalUrl(bad)).toBeNull();
    expect(isFrameMessage({ priors: 1, type: "link", url: "https://x.y" })).toBe(true);
  });
  it("clamps heights", () => {
    expect(clampHeight(10)).toBe(60);
    expect(clampHeight(1e6)).toBe(4000);
    expect(clampHeight(312.2)).toBe(313);
  });
});

describe("theme tokens", () => {
  it("the preview themes match the site's own light and dark tokens", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const block = (sel: string) => { const at = css.indexOf(sel); return css.slice(at, css.indexOf("}", at)); };
    for (const [mode, sel] of [["light", ":root {"], ["dark", ':root[data-theme="dark"] {']] as const) {
      const src = block(sel);
      for (const [name, token] of Object.entries(EMBED_COLORS)) {
        const m = src.match(new RegExp(`${token}:\\s*([^;]+);`));
        expect(m?.[1].trim(), `${mode} ${token}`).toBe(DEFAULT_EMBED_THEMES[mode].colors[name as keyof typeof EMBED_COLORS]);
      }
    }
  });
});
