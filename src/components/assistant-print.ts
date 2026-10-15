import type { AnswerChart } from "@/lib/answer-chart";
import { answerHeight, answerOption } from "./chart/answer-option";
import { echarts, GREY, HAIR, INK, LIGHT_PALETTE, themeFor } from "./chart/theme";

export type PrintTurn = { role: "user" | "assistant"; content: string; question?: string; charts?: AnswerChart[]; error?: boolean };

const WIDTH = 640;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const inline = (s: string) => esc(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

/** A chart as standalone SVG, always in the light palette (paper is white). */
function chartSvg(c: AnswerChart): string {
  const chart = echarts.init(null, themeFor(LIGHT_PALETTE), { renderer: "svg", ssr: true, width: WIDTH, height: answerHeight(c) });
  chart.setOption({ ...answerOption(c, LIGHT_PALETTE, () => WIDTH), animation: false });
  const svg = chart.renderToSVGString();
  chart.dispose();
  const key = c.kind === "grouped" ? `<span class="key">${c.series.map(esc).join(" · ")}</span>` : "";
  return `<figure><figcaption>${esc(c.title)}${key}</figcaption>${svg}</figure>`;
}

/** Reply text the way AssistantAnswer reads it: paragraphs, "- " lists, **bold** and [[chart:N]]. */
function replyHtml(text: string, charts: AnswerChart[] = []): string {
  return text.split(/(\[\[chart:\d+\]\])/).filter(Boolean).map((block) => {
    const n = block.match(/^\[\[chart:(\d+)\]\]$/);
    if (n) { const c = charts[Number(n[1]) - 1]; return c ? chartSvg(c) : ""; }
    return block.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => {
      const lines = p.split("\n");
      if (lines.every((l) => /^\s*[-•*]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•*]\s+/, ""))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(inline).join("<br>")}</p>`;
    }).join("");
  }).join("");
}

/** The conversation as a printable page: each question, its answer and charts, and where it came from. */
export function chatDocument(turns: PrintTurn[], meta: { title: string; index: string; date: string; url: string }): string {
  const body = turns.filter((t) => !t.error).map((t) => t.role === "user"
    ? `<p class="q">${esc(t.content)}</p>`
    : `<div class="a">${replyHtml(t.content, t.charts)}${t.question ? `<p>${esc(t.question)}</p>` : ""}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(meta.title)}</title><style>
@page { margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { margin: 0 auto; max-width: ${WIDTH + 24}px; padding: 8px 12px; font: 13px/1.55 Inter, system-ui, sans-serif; color: ${INK}; }
header { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding-bottom: 10px; margin-bottom: 6px; border-bottom: 1px solid ${HAIR}; }
header b { font-size: 15px; } header span, footer { color: ${GREY}; font-size: 11px; }
.q { margin: 20px 0 6px; padding-left: 10px; border-left: 2px solid ${HAIR}; color: ${LIGHT_PALETTE.ink2}; break-after: avoid; }
.a p { margin: 0 0 8px; } .a ul { margin: 0 0 8px; padding-left: 18px; }
figure { margin: 10px 0 14px; padding: 10px 12px 4px; border: 1px solid ${HAIR}; border-radius: 6px; break-inside: avoid; }
figcaption { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; font-weight: 500; margin-bottom: 4px; }
figcaption .key { font-weight: 400; color: ${LIGHT_PALETTE.ink2}; }
svg { display: block; max-width: 100%; height: auto; }
footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid ${HAIR}; }
a { color: inherit; }
</style></head><body><header><b>Priors assistant · ${esc(meta.index)}</b><span>Data as of ${esc(meta.date)}</span></header>${body}<footer>Answers come from the benchmark data on Priors as of ${esc(meta.date)}. <a href="${esc(meta.url)}">${esc(meta.url.replace(/^https?:\/\//, "").replace(/[?#].*$/, ""))}</a></footer></body></html>`;
}

/** Opens the print dialog on the document (Save as PDF lives there) without leaving the page. */
export function printDocument(html: string, title: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.srcdoc = html;
  frame.onload = () => {
    const win = frame.contentWindow;
    if (!win) return;
    // Browsers name the PDF after the top page's title, so borrow it for the dialog.
    const prev = document.title;
    document.title = title;
    const done = () => { document.title = prev; frame.remove(); };
    win.addEventListener("afterprint", done, { once: true });
    win.focus();
    win.print();
    setTimeout(() => { if (frame.isConnected) done(); }, 120_000);
  };
  document.body.appendChild(frame);
}
