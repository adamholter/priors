import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScrapeContext } from "../../src/data/types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export const RAW_DIR = path.resolve(process.cwd(), "data/raw");

export function makeContext(sourceId: string, log = (m: string) => console.log(`[${sourceId}] ${m}`)): ScrapeContext {
  const now = new Date().toISOString();
  async function fetchWithRetry(url: string, init?: RequestInit, tries = 3): Promise<Response> {
    let last: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, { ...init, headers: { "user-agent": UA, accept: "*/*", ...(init?.headers ?? {}) } });
        if (res.ok) return res;
        if (res.status === 429 || res.status >= 500) { last = new Error(`${res.status} ${url}`); await sleep(800 * (i + 1)); continue; }
        throw new Error(`${res.status} ${url}`);
      } catch (e) { last = e; await sleep(600 * (i + 1)); }
    }
    throw last instanceof Error ? last : new Error(String(last));
  }
  return {
    now,
    log,
    fetchText: async (url, init) => (await fetchWithRetry(url, init)).text(),
    fetchJson: async (url, init) => (await fetchWithRetry(url, init)).json(),
    withPage: async (url, fn) => {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage({ userAgent: UA, viewport: { width: 1440, height: 1200 } });
        await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 });
        return await fn(page);
      } finally { await browser.close(); }
    },
  };
}

export async function saveRaw(sourceId: string, date: string, files: Record<string, string>) {
  const dir = path.join(RAW_DIR, date, sourceId);
  await mkdir(dir, { recursive: true });
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(path.join(dir, name), content)));
  return dir;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Parse "70%±3%" / "70.2" / "$13.41" / "80k" style cells. */
export function num(s: string | number | null | undefined): number | undefined {
  if (s == null) return undefined;
  if (typeof s === "number") return Number.isFinite(s) ? s : undefined;
  const t = s.replace(/[,$%\s]/g, "").replace(/±.*$/, "");
  const m = t.match(/^(-?\d+(?:\.\d+)?)(k|m)?$/i);
  if (!m) return undefined;
  const v = parseFloat(m[1]) * (m[2]?.toLowerCase() === "k" ? 1e3 : m[2]?.toLowerCase() === "m" ? 1e6 : 1);
  return Number.isFinite(v) ? v : undefined;
}

export function ci(s: string): [number, number] | undefined {
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*%?\s*±\s*(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  const v = parseFloat(m[1]), d = parseFloat(m[2]);
  return [v - d, v + d];
}
