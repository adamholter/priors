import { z } from "zod";
import { loadSnapshot } from "@/data/load";
import { decodeIndex } from "@/lib/url";
import { decodeSpec } from "@/lib/answer-chart";
import { DataView } from "@/agent/data";
import { makeChart } from "@/agent/charts";

export const runtime = "nodejs";

const list = z.array(z.string().max(80)).max(40);
const spec = z.object({
  type: z.enum(["bar", "effort_lines", "effort_compare", "effort_delta", "scatter"]).optional(),
  metric: z.string().max(80).optional(), x_metric: z.string().max(80).optional(), metrics: list.optional(),
  models: list.optional(), variants: list.optional(), labs: list.optional(), top: z.number().int().min(1).max(40).optional(),
  efforts: z.union([z.enum(["best", "all"]), list]).optional(), from_effort: z.string().max(20).optional(), to_effort: z.string().max(20).optional(),
  delta: z.enum(["absolute", "percent"]).optional(), title: z.string().max(120).optional(),
}).strict();

/**
 * Redraw an assistant chart from its link: the recipe (`c`) and the index it was asked under (`i`).
 * No model call and no sign-in, so a shared link works for anyone; every value comes from the data.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams, i = q.get("i") ?? "", c = q.get("c") ?? "", date = q.get("date") ?? undefined;
  if (i.length > 4000 || c.length > 4000 || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) return Response.json({ error: "Invalid link." }, { status: 400 });
  const parsed = spec.safeParse(decodeSpec(c));
  const config = decodeIndex(i, "chart");
  if (!parsed.success || !config || !Object.keys(config.weights).length) return Response.json({ error: "Invalid link." }, { status: 400 });
  const snapshot = await loadSnapshot(date);
  if (!snapshot) return Response.json({ error: "Benchmark data unavailable." }, { status: 404 });
  const r = makeChart(new DataView(snapshot, config), parsed.data);
  if (!r.chart) return Response.json({ error: r.error ?? "That chart can't be drawn." }, { status: 422 });
  r.chart.title = r.chart.title.replace(/\s*[—–]\s*/g, ": ");
  return Response.json({ chart: { ...r.chart, spec: parsed.data, index: i }, missing: r.missing?.length ? r.missing : undefined }, { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } });
}
