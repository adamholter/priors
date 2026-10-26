import type { Snapshot } from "../data/types";
import { LIGHT_PALETTE } from "../components/chart/theme";
import { escapeSvg } from "../components/chart/export-frame";
import { RADAR_PALETTES } from "../components/chart/radar-view";
import { rankSide, type Choice } from "../components/compare/choice";
import { biggestGaps, pairUp, rankCorrelation, topOverlap } from "./compare";
import { rasterize } from "./og-chart";

const ACCENT = "#2F4FB0", W = 1200, H = 630, SHOW = 7, ROW = 46;
void LIGHT_PALETTE;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The words under a comparison's title, shared with the page's link-preview text. */
export function compareLead(snapshot: Snapshot, a: Choice, b: Choice) {
  const sa = rankSide(snapshot, a), sb = rankSide(snapshot, b);
  const { shared, n } = topOverlap(sa.placed, sb.placed, 10);
  const { rho } = rankCorrelation(sa.placed, sb.placed);
  const pairs = pairUp(sa.placed, sb.placed).pairs;
  const gap = biggestGaps(pairs, 1, 3, 10)[0];
  return { sa, sb, shared: shared.length, n, rho, pairs, gap };
}

/** The share card for a comparison (1200×630): both sides' top lists as a slope, with how much they agree. */
export function renderCompareCard(snapshot: Snapshot, a: Choice, b: Choice): Buffer {
  const pal = RADAR_PALETTES.light, e = escapeSvg;
  const { sa, sb, shared, n, rho, gap } = compareLead(snapshot, a, b);
  const A = sa.placed.slice(0, SHOW), B = sb.placed.slice(0, SHOW);
  const top = 270, y = (i: number) => top + i * ROW;
  const posB = new Map(B.map((p, i) => [p.modelId, i])), posA = new Map(A.map((p, i) => [p.modelId, i]));
  const lead = n === 0 ? "" : shared === n ? `The top ${n} are the same on both lists.` : shared === 0 ? `No model is in both top ${n} lists.` : `${shared} of the top ${n} are on both lists.`;
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="${pal.bg}"/>`];
  out.push(`<text x="64" y="104" font-family="Newsreader" font-size="58" fill="${pal.ink}">${e(clip(a.title, 18))} <tspan fill="${pal.grey}" font-size="40">vs</tspan> ${e(clip(b.title, 18))}</text>`);
  out.push(`<text x="64" y="156" font-family="Inter" font-weight="500" font-size="28" fill="${pal.ink}">${e(lead)}</text>`);
  const sub = [rho != null ? `Order agreement ${rho.toFixed(2)}` : "", gap ? `${gap.name} is #${gap.a!.rank} for ${a.short}, #${gap.b!.rank} for ${b.short}` : ""].filter(Boolean).join("  ·  ");
  out.push(`<text x="64" y="196" font-family="Inter" font-size="21" fill="${pal.ink2}">${e(clip(sub, 90))}</text>`);
  out.push(`<rect x="392" y="${top - 52}" width="12" height="12" rx="2" fill="${ACCENT}"/><text x="412" y="${top - 41}" font-family="Inter" font-weight="600" font-size="19" fill="${pal.ink}">${e(clip(a.title, 22))}</text>`);
  out.push(`<rect x="764" y="${top - 52}" width="12" height="12" rx="2" fill="${pal.ink2}"/><text x="784" y="${top - 41}" font-family="Inter" font-weight="600" font-size="19" fill="${pal.ink}">${e(clip(b.title, 22))}</text>`);
  A.forEach((p, i) => {
    out.push(`<text x="560" y="${y(i) + 7}" text-anchor="end" font-family="Inter" font-size="23" fill="${pal.ink}">${e(clip(p.name, 24))}</text><text x="580" y="${y(i) + 6}" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">${p.rank}</text>`);
    const j = posB.get(p.modelId);
    const move = j != null && Math.abs(j - i) >= 3;
    out.push(j != null
      ? `<path d="M600 ${y(i)} C 650 ${y(i)} 650 ${y(j)} 700 ${y(j)}" fill="none" stroke="${move ? pal.ink2 : "#C9C8BF"}" stroke-width="${move ? 2.4 : 1.6}"/>`
      : `<path d="M600 ${y(i)} H630" stroke="#C9C8BF" stroke-width="1.6" stroke-dasharray="3 3"/>`);
  });
  B.forEach((p, i) => {
    out.push(`<text x="720" y="${y(i) + 6}" text-anchor="end" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">${p.rank}</text><text x="740" y="${y(i) + 7}" font-family="Inter" font-size="23" fill="${pal.ink}">${e(clip(p.name, 24))}</text>`);
    if (!posA.has(p.modelId)) out.push(`<path d="M670 ${y(i)} H700" stroke="#C9C8BF" stroke-width="1.6" stroke-dasharray="3 3"/>`);
  });
  out.push(`<text x="64" y="${H - 34}" font-family="JetBrains Mono" font-size="15" fill="${pal.grey}">${e(`mypriors.com/compare · ${snapshot.date}`)}</text>`);
  out.push(`<text x="${W - 50}" y="${H - 32}" text-anchor="end" font-family="Newsreader" font-size="36" fill="${pal.ink}">pr<tspan fill="${ACCENT}">i</tspan>ors</text>`);
  out.push("</svg>");
  return rasterize(out.join(""), pal.bg);
}
