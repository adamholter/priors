import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import type { ScrapeContext } from "../../src/data/types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

export const RAW_DIR = path.resolve(process.cwd(), "data/raw");

export function makeContext(sourceId: string, log = (m: string) => console.log(`[${sourceId}] ${m}`)): ScrapeContext {
  const now = new Date().toISOString();
  async function fetchWithRetry(url: string, init?: RequestInit, tries = 3): Promise<Response> {
    let last: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(url, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(60_000), headers: { "user-agent": UA, accept: "*/*", "cache-control": "no-cache", ...(init?.headers ?? {}) } });
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

/** Entries of a .zip (e.g. an .xlsx) using Node's zlib: stored and deflated members only. */
export function unzip(buf: Buffer): Map<string, Buffer> {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Bad zip directory");
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28), data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data) : data);
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

/** First sheet of an .xlsx as rows of header → cell text (shared strings and inline values resolved). */
export function xlsxRows(buf: Buffer): Record<string, string>[] {
  const files = unzip(buf), decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const strings = [...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")));
  const sheet = files.get("xl/worksheets/sheet1.xml")?.toString("utf8");
  if (!sheet) throw new Error("xlsx has no sheet1");
  const grid = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((r) => {
    const cells: Record<string, string> = {};
    for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const body = c[3] ?? "", v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? body.replace(/<[^>]+>/g, "");
      cells[c[1]] = /t="s"/.test(c[2]) ? strings[Number(v)] ?? "" : decode(v);
    }
    return cells;
  });
  const header = grid[0] ?? {};
  return grid.slice(1).map((cells) => Object.fromEntries(Object.entries(header).map(([col, name]) => [name, cells[col] ?? ""])));
}
