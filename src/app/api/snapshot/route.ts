import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { loadSnapshot } from "@/data/load";
import { clientSnapshot } from "@/data/client-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const run = promisify(execFile);
const state = globalThis as typeof globalThis & { priorsRefresh?: Promise<void> };
const localRefresh = process.env.NODE_ENV === "development" && !process.env.VERCEL;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const view = url.searchParams.get("view");
  const date = url.searchParams.get("date") ?? undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid snapshot date." }, { status: 400 });
  const snapshot = await loadSnapshot(date);
  if (!snapshot) return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  const requestedVersion = url.searchParams.get("version");
  if (requestedVersion && requestedVersion !== snapshot.generatedAt) return NextResponse.json({ error: "Snapshot changed. Reload to see the latest data." }, { status: 409 });
  if (view === "meta") return NextResponse.json({ date: snapshot.date, generatedAt: snapshot.generatedAt, refreshing: !!state.priorsRefresh, canRefresh: localRefresh }, { headers: { "Cache-Control": "no-store" } });
  if (view === "core") return NextResponse.json({ snapshot: clientSnapshot(snapshot) }, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300" } });
  return NextResponse.json({ snapshot, refreshing: !!state.priorsRefresh, canRefresh: localRefresh }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  const origin = req.headers.get("origin");
  const loopback = ["localhost", "127.0.0.1", "[::1]"];
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  if (!localRefresh || !loopback.includes(hostname) || (origin && origin !== `${url.protocol}//${host}`) || req.headers.get("x-priors-refresh") !== "1") {
    return NextResponse.json({ error: "Source refresh is available only on the local development server." }, { status: 403 });
  }
  if (!state.priorsRefresh) {
    state.priorsRefresh = run(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), path.resolve("scripts/scrape/build.ts")], {
      cwd: process.cwd(), timeout: 300_000, maxBuffer: 2 * 1024 * 1024,
    }).then(() => undefined).finally(() => { state.priorsRefresh = undefined; });
  }
  try {
    await state.priorsRefresh;
    return GET(new Request(`${url.origin}/api/snapshot?view=core`));
  } catch {
    return NextResponse.json({ error: "Refresh failed. The last successful snapshot is still available." }, { status: 502 });
  }
}
