import { escapeSvg } from "./export-frame";

/** One leaderboard row as the image draws it: `share` is the bar's length, 0 to 1. `effort` prints small after the name. */
export interface RankingImageRow { rank: number; label: string; effort?: string; value: string; share: number; fill: string }

/** A row's height at a label size (1 is the page's own). */
export const rankingRowPitch = (scale = 1) => Math.round(30 * scale);
/** How many rows an image this tall holds. Never none. */
export const rankingRowsFit = (height: number, scale = 1) => Math.max(1, Math.floor((height + 4) / rankingRowPitch(scale)));
/** The height that holds exactly this many rows. */
export const rankingHeightFor = (rows: number, scale = 1) => rows * rankingRowPitch(scale) - 4;

// SVG text cannot shorten itself the way the page's rows do, so a long name is cut to the column by average glyph width.
const fit = (text: string, px: number, size: number) => { const n = Math.max(3, Math.floor(px / (size * 0.54))); return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text; };

/**
 * The leaderboard as an image exactly `width` by `height`: rank, name, bar and value on each row, like the page's own rows,
 * with as many rows as the height holds. The screenshot editor draws this and exports it, so a taller image shows more models.
 */
export function rankingsImageSvg(rows: RankingImageRow[], o: { width: number; height: number; scale?: number; bg: string; ink: string; grey: string; track: string; sans: string; mono: string; defs?: string }): string {
  const scale = o.scale ?? 1, pitch = rankingRowPitch(scale), size = 12.5 * scale, small = 10.5 * scale, bar = Math.round(12 * scale), gap = Math.round(10 * scale);
  const rankW = Math.round(24 * scale), valueW = Math.round(46 * scale), nameW = Math.round(Math.min(220 * scale, Math.max(96 * scale, o.width * 0.27)));
  const barX = rankW + gap + nameW + gap, barW = Math.max(24, o.width - barX - gap - valueW);
  const body = rows.slice(0, rankingRowsFit(o.height, scale)).map((r, i) => {
    const mid = i * pitch + (pitch - 4) / 2, base = mid + size * 0.35;
    const effort = r.effort ? ` ${r.effort}` : "", name = fit(r.label, nameW - effort.length * small * 0.62, size);
    return `<text x="${rankW}" y="${base}" text-anchor="end" font-family="${o.mono}" font-size="${small}" fill="${o.grey}">${r.rank}</text>`
      + `<text x="${rankW + gap}" y="${base}" font-family="${o.sans}" font-size="${size}" fill="${o.ink}">${escapeSvg(name)}${r.effort ? `<tspan font-family="${o.mono}" font-size="${small}" fill="${o.grey}" dx="${6 * scale}">${escapeSvg(r.effort)}</tspan>` : ""}</text>`
      + `<rect x="${barX}" y="${mid - bar / 2}" width="${barW}" height="${bar}" rx="2" fill="${o.track}"/>`
      + `<rect x="${barX}" y="${mid - bar / 2}" width="${(Math.max(0, Math.min(1, r.share)) * barW).toFixed(1)}" height="${bar}" rx="2" fill="${r.fill}"/>`
      + `<text x="${o.width}" y="${base}" text-anchor="end" font-family="${o.mono}" font-size="${size}" fill="${o.ink}">${escapeSvg(r.value)}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" viewBox="0 0 ${o.width} ${o.height}">${o.defs ? `<defs>${o.defs}</defs>` : ""}<rect width="${o.width}" height="${o.height}" fill="${o.bg}"/>${body}</svg>`;
}
