export function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!));
}

/**
 * Frames a chart SVG for export: bone background, padding on every side, the chart title in the
 * site serif at top-left, and a quiet source line at bottom-left, so images never start flush at the
 * axis label. `footer: "right"` moves the source line to the bottom-right (link-preview cards
 * overlay a title pill at bottom-left).
 */
export function frameSvg(raw: string, title: string, date?: string, pal: { bg: string; ink: string; grey: string } = { bg: "#FBFBF9", ink: "#1A1A1A", grey: "#8A8A80" }, opts?: { footer?: "left" | "right" }) {
  const open = raw.match(/<svg[^>]*>/)?.[0] ?? "";
  const w = Number(open.match(/width="([\d.]+)/)?.[1] ?? 800), h = Number(open.match(/height="([\d.]+)/)?.[1] ?? 400);
  const pad = 32, foot = 34, W = Math.round(w + pad * 2), H = Math.round(h + pad + 22 + foot);
  const inner = raw.replace(/^<\?xml[^>]*>\s*/, "").replace(/<svg/, `<svg x="${pad}" y="${pad + 22}"`);
  const footerX = opts?.footer === "right" ? W - pad : pad;
  const anchor = opts?.footer === "right" ? ` text-anchor="end"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${pal.bg}"/>`
    + `<text x="${pad}" y="${pad + 14}" font-family="Newsreader, Georgia, serif" font-size="24" fill="${pal.ink}">${escapeSvg(title)}</text>`
    + inner
    + `<text x="${footerX}" y="${H - 16}"${anchor} font-family="JetBrains Mono, Menlo, monospace" font-size="11" fill="${pal.grey}">mypriors.com${date ? ` · ${escapeSvg(date)}` : ""}</text></svg>`;
}

/**
 * Crops empty space off the right of a chart SVG. Plots reserve room on the right for labels that may
 * run past the last mark, so an export often has a blank band there. The svg is measured in the
 * browser; whatever is drawn (marks, labels, axis titles) keeps `margin` px, and a full-width background rect does not count.
 */
export function trimRight(svg: string, margin = 10): string {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none";
  host.innerHTML = svg.replace(/^<\?xml[^>]*>\s*/, "");
  document.body.appendChild(host);
  try {
    const root = host.querySelector("svg"); if (!root) return svg;
    const w = Number(root.getAttribute("width")), h = Number(root.getAttribute("height"));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0) return svg;
    const left = root.getBoundingClientRect().left;
    let right = 0;
    for (const el of root.querySelectorAll("path,text,circle,line,polyline,polygon,ellipse,rect,image")) {
      if (el.getAttribute("opacity") === "0" || (el.getAttribute("fill") === "none" && (!el.getAttribute("stroke") || el.getAttribute("stroke") === "none"))) continue;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      if (el.tagName === "rect" && r.width >= w * 0.98) continue;
      right = Math.max(right, r.right - left);
    }
    const next = Math.ceil(right + margin);
    if (!right || next >= w) return svg;
    return svg.replace(/<svg[^>]*>/, (open) => open.replace(/width="[\d.]+"/, `width="${next}"`).replace(/viewBox="[^"]*"/, `viewBox="0 0 ${next} ${h}"`));
  } finally { host.remove(); }
}
