import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { loadSnapshot } from "@/data/load";
import { mergeImports } from "@/lib/import";
import { decodeIndex } from "@/lib/url";
import { defaultConfig, type IndexConfig } from "@/engine";
import type { Snapshot } from "@/data/types";

/** Where a tool's index comes from: a config object, an `i=` link value, a `url`, or a published page (`@handle`, with its own imported benchmarks). */
export const INDEX_PARAM = {
  description: "Which index to use. Omit for the default General frontier index. Pass a handle (\"@adamholter\" or \"@adamholter/coding\" for one of that page's indices), a mypriors.com link, an encoded index string (the `i=` value of a link), or an index object { name, weights: { benchmarkId: weight }, ...any IndexConfig field }. An object is merged onto the default, so only changes need to be given.",
  anyOf: [{ type: "string" }, { type: "object" }],
};

export class ToolError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

export const convex = () => {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new ToolError("Convex is not configured on this server.", 500);
  return new ConvexHttpClient(url);
};

export async function publicPage(handle: string) {
  return (await convex().query(api.profiles.byHandle, { handle: handle.replace(/^@/, "").toLowerCase() })) as { handle: string; displayName: string; indices: IndexConfig[]; imports?: { benchmark: Record<string, unknown>; rows: Record<string, unknown>[] }[]; [k: string]: unknown } | null;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** The snapshot (with a page's imports merged in, when the index names a page) and the index config to use. */
export async function resolveIndex(ref: unknown, date?: string): Promise<{ snapshot: Snapshot; config: IndexConfig; page?: string; unknownImports: string[] }> {
  const base = await loadSnapshot(date);
  if (!base) throw new ToolError("Benchmark data is unavailable.", 503);
  const fallback = defaultConfig(base);
  if (ref == null || ref === "") return { snapshot: base, config: fallback, unknownImports: [] };
  if (typeof ref === "object") {
    const o = ref as Partial<IndexConfig>;
    if (o.weights && typeof o.weights !== "object") throw new ToolError("index.weights must be an object of benchmarkId to weight.");
    const config = { ...fallback, ...o, weights: o.weights ?? fallback.weights, required: o.required ?? [], id: o.id ?? "mcp", name: o.name ?? "Custom" } as IndexConfig;
    if (!Object.values(config.weights).some((w) => Number(w) > 0)) throw new ToolError("index.weights needs at least one benchmark with a positive weight.");
    return { snapshot: base, config, unknownImports: [] };
  }
  let s = String(ref).trim();
  if (/^https?:\/\//i.test(s)) {
    const u = new URL(s), i = u.searchParams.get("i");
    if (i) s = i; else { const h = u.pathname.split("/").filter(Boolean)[0]; if (!h) throw new ToolError("That link has no index in it."); s = `@${h}`; }
  }
  if (s.startsWith("@")) {
    const [handle, which] = s.slice(1).split("/");
    const page = await publicPage(handle);
    if (!page) throw new ToolError(`No page at @${handle}.`, 404);
    const pick = which ? page.indices.find((x) => x.id === which || slug(x.name) === slug(which)) : page.indices[0];
    if (!pick) throw new ToolError(`@${handle} has no index "${which}". It has: ${page.indices.map((x) => x.id).join(", ")}.`, 404);
    const merged = mergeImports(base, (page.imports ?? []) as never);
    return { snapshot: merged.snapshot, config: pick, page: page.handle, unknownImports: merged.unknown };
  }
  const decoded = decodeIndex(decodeURIComponent(s.split("&")[0]), "mcp");
  if (!decoded) throw new ToolError("Could not read that index. Pass an object, a @handle or an `i=` link value.");
  return { snapshot: base, config: decoded, unknownImports: [] };
}
