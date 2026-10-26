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
