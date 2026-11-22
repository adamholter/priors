"use client";

export interface BenchLine { id: string; name: string; points: { date: string; rating: number }[] }

/** One color per line: several of the top models share a lab, so lab colors would not tell them apart. Readable on light and dark. */
const COLORS = ["#3E63D6", "#E0702F", "#2E9A62", "#C23C7E", "#8A63D2", "#C9A227", "#2AA3C2", "#8C8C84"];
/** Drawn twice: wide for desktop and a narrow one for phones, each at about 1:1 so the text stays readable. */
const SIZES = { wide: { W: 680, H: 360, PAD: { l: 44, r: 128, t: 12, b: 28 }, font: 11, every: 6 }, narrow: { W: 358, H: 300, PAD: { l: 36, r: 104, t: 10, b: 26 }, font: 10, every: 3 } };
const shortDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Each model's PriorsBench rating at the end of every week, one line per model, labeled at its right end. */
export function PriorsBenchChart({ dates, lines }: { dates: string[]; lines: BenchLine[] }) {
  return <><div className="max-sm:hidden"><Chart dates={dates} lines={lines} size="wide" /></div><div className="sm:hidden"><Chart dates={dates} lines={lines} size="narrow" /></div></>;
}

function Chart({ dates, lines, size }: { dates: string[]; lines: BenchLine[]; size: keyof typeof SIZES }) {
  const { W, H, PAD, font, every: labels } = SIZES[size];
  const all = lines.flatMap((l) => l.points.map((p) => p.rating));
  if (!all.length || dates.length < 2) return null;
  const lo = Math.floor((Math.min(...all) - 40) / 100) * 100, hi = Math.ceil((Math.max(...all) + 40) / 100) * 100;
  const x = (d: string) => PAD.l + (dates.indexOf(d) / (dates.length - 1)) * (W - PAD.l - PAD.r);
  const y = (r: number) => PAD.t + (1 - (r - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const step = hi - lo > 1200 ? 400 : hi - lo > 600 ? 200 : 100;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(t);
  // End labels, pushed apart so they never overlap.
  const ends = lines.map((l) => ({ l, at: y(l.points.at(-1)!.rating) })).sort((a, b) => a.at - b.at);
  for (let i = 1; i < ends.length; i++) ends[i].at = Math.max(ends[i].at, ends[i - 1].at + font + 3);
  const overflow = ends.length ? ends.at(-1)!.at - (H - PAD.b) : 0;
  if (overflow > 0) for (const e of ends) e.at -= overflow;
  const every = Math.max(1, Math.ceil(dates.length / labels));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="PriorsBench ratings by week">
      {ticks.map((t) => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--hair)" strokeWidth={1} /><text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--grey)" className="tabular-nums">{t}</text></g>)}
      {dates.map((d, i) => (i % every === 0 || i === dates.length - 1) && <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--grey)">{shortDate(d)}</text>)}
      {lines.map((l, k) => {
        const c = COLORS[k % COLORS.length];
        return <g key={l.id}>
          <polyline fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={l.points.map((p) => `${x(p.date)},${y(p.rating)}`).join(" ")} />
          {l.points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.rating)} r={2.5} fill={c} />)}
        </g>;
      })}
      {ends.map(({ l, at }) => { const last = l.points.at(-1)!, c = COLORS[lines.indexOf(l) % COLORS.length]; return <g key={l.id}>
        <line x1={x(last.date) + 3} x2={W - PAD.r + 6} y1={y(last.rating)} y2={at} stroke="var(--hair)" strokeWidth={1} />
        <circle cx={W - PAD.r + 12} cy={at} r={3.5} fill={c} /><text x={W - PAD.r + 19} y={at + 4} fontSize={font} fill="var(--ink-2)">{l.name}</text>
      </g>; })}
    </svg>
  );
}
