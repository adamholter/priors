import { themeById, type PagePreset } from "@/lib/page-presets";

/** A miniature of the theme: its surface, a card, accent, two lab marks and its type. */
export function ThemeSwatch({ theme, selected, onClick }: { theme: PagePreset; selected: boolean; onClick: () => void }) {
  const pair = themeById(theme.pair);
  const labs = Object.values(theme.labColors ?? (theme.library ? { a: theme.accent, b: theme.ink2, c: theme.grey } : { a: "#C96A4A", b: "#3B78D8", c: "#2B2B2B" })).slice(0, 4);
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`theme-swatch ${selected ? "is-on" : ""}`} style={{ background: theme.bg, color: theme.ink, borderRadius: Math.min(theme.radius ?? 4, 8) }}>
    <span className="theme-swatch-card" style={{ background: theme.surface ?? (theme.dark ? theme.hair2 : "#fff"), borderColor: theme.hair, borderRadius: Math.min(theme.radius ?? 4, 6) }}>
      <span className="theme-swatch-type" style={{ fontFamily: theme.fonts?.serif }}>Aa</span>
      <span className="theme-swatch-bars">{labs.map((c, i) => <i key={i} style={{ background: c, height: `${90 - i * 18}%`, borderRadius: theme.chart?.barRadius ?? 1 }} />)}</span>
    </span>
    <span className="theme-swatch-name" style={{ fontFamily: theme.fonts?.sans }}>{theme.name}{pair ? <em> · light & dark</em> : null}</span>
    <i className="theme-swatch-accent" style={{ background: theme.accent }} />
  </button>;
}
