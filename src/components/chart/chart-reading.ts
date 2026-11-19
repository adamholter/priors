/**
 * What a chart shows right now, read from the page for the chart settings agent: the card's visible text (title, caption, notes,
 * legend) and, for an ECharts chart, its axes and every plotted point. Read when the person sends a request, so it is always current.
 */

/**
 * The chart card around a settings menu: the widest ancestor that still holds only this chart's toolbar (a page stacks many charts,
 * and one ancestor too far up would read the next chart's points).
 */
function cardOf(from: Element): Element | null {
  let card: Element | null = from.closest(".chart-toolbar")?.parentElement ?? from.parentElement;
  for (let el = card?.parentElement, i = 0; el && i < 4; el = el.parentElement, i++) {
    if (el.querySelectorAll(".chart-toolbar").length > 1 || el.querySelectorAll("[_echarts_instance_]").length > 1 || el === document.body) break;
    card = el;
  }
  return card;
}

/** The card's text, leaving out the settings menu itself. */
function visibleText(card: Element, skip: Element | null): string {
  const parts: string[] = [];
  const walk = document.createTreeWalker(card, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (skip && skip.contains(n)) || n.parentElement?.closest("script, style, .chart-settings-menu") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) { const t = n.textContent?.replace(/\s+/g, " ").trim(); if (t) parts.push(t); }
  return parts.join(" | ").slice(0, 4000);
}

type Axis = { name?: string; type?: string; data?: unknown[]; min?: unknown; max?: unknown };
type Series = { type?: string; id?: string; name?: string; data?: unknown[] };
const fmt = (v: unknown) => typeof v === "number" ? (Math.abs(v) >= 1000 || Number.isInteger(v) ? String(Math.round(v * 100) / 100) : v.toPrecision(4)) : v == null ? "" : String(v);
const axisLine = (label: string, a?: Axis) => a ? `${label}: ${a.name ?? "(no name)"}, ${a.type ?? "value"}${a.type === "log" ? " scale" : ""}${a.data ? `, categories ${a.data.slice(0, 60).map(fmt).join(", ")}` : ""}` : "";

/** One line per series: points as "name (x, y)", or for lines just the ids they join. */
function seriesLines(series: Series[], xCats?: unknown[], yCats?: unknown[]): string[] {
  const lines: string[] = [];
  let points = 0;
  for (const s of series) {
    const data = s.data ?? [];
    if (s.type === "line" && /^link-/.test(s.id ?? "")) continue; // a model's effort line repeats its points
    if (s.type === "line") { lines.push(`Line ${s.id ?? s.name ?? ""}: ${data.map((d) => (d as { id?: string })?.id ?? "").filter(Boolean).join(" → ")}`); continue; }
    const items = data.slice(0, Math.max(0, 500 - points)).map((d, i) => {
      const o = (d && typeof d === "object" && !Array.isArray(d) ? d : { value: d }) as { name?: string; id?: string; value?: unknown };
      const v = Array.isArray(o.value) ? o.value : [o.value];
      const cat = xCats?.[i] ?? yCats?.[i];
      const name = o.name ?? (cat != null ? String(cat) : o.id ?? "");
      return `${name}${o.id && o.id !== name ? ` [${o.id}]` : ""} (${v.map(fmt).join(", ")})`;
    });
    points += items.length;
    lines.push(`${s.type ?? "series"} ${s.name ?? s.id ?? ""} (${data.length} points): ${items.join("; ")}${data.length > items.length ? "; …" : ""}`);
  }
  return lines;
}

/** Plain lines describing the chart around `menuRoot`, for the agent. */
export async function readChart(menuRoot: Element | null): Promise<string> {
  if (!menuRoot) return "";
  const card = cardOf(menuRoot);
  if (!card) return "";
  const lines = [`Visible text on the chart card: ${visibleText(card, menuRoot.querySelector(".chart-settings-menu"))}`];
  const canvas = card.querySelector("[_echarts_instance_]") as HTMLElement | null;
  if (canvas) {
    try {
      const { getInstanceByDom } = await import("echarts");
      const option = getInstanceByDom(canvas)?.getOption() as { xAxis?: Axis[]; yAxis?: Axis[]; series?: Series[] } | undefined;
      if (option) {
        const x = option.xAxis?.[0], y = option.yAxis?.[0];
        lines.push("Plotted (x, y):", axisLine("x axis", x), axisLine("y axis", y), ...seriesLines(option.series ?? [], x?.data, y?.data));
      }
    } catch { lines.push("(The chart's points could not be read.)"); }
  } else lines.push("(No drawn chart found: this chart is a list or table; its text above is what it shows.)");
  return lines.filter(Boolean).join("\n");
}
