import { computeHistory } from "@/lib/history";
import { decodeIndex } from "@/lib/url";
import { defaultConfig } from "@/engine";
import { loadSnapshot } from "@/data/load";

export const runtime = "nodejs";
export const maxDuration = 60;

/** The ranking on every snapshot date for an index (default: General frontier). Public, no model call. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, i = q.get("i") ?? "", mode = q.get("mode") === "adapting" ? "adapting" : "fixed";
  if (i.length > 4000) return Response.json({ error: "Invalid index." }, { status: 400 });
  const latest = await loadSnapshot();
  if (!latest) return Response.json({ error: "Benchmark data unavailable." }, { status: 404 });
  const config = i ? decodeIndex(i, "history") : defaultConfig(latest);
  if (!config || !Object.keys(config.weights).length) return Response.json({ error: "Invalid index." }, { status: 400 });
  const data = await computeHistory(config, mode, `${i || "default"}|${latest.date}`);
  return Response.json(data, { headers: { "cache-control": "public, max-age=300, s-maxage=1800" } });
}
