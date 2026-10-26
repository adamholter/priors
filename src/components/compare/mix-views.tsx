import { mixLead, type MixRow } from "@/lib/compare";

/** Why two rankings differ is their benchmark weights: a plain sentence, then each ranking's whole mix as one bar. */
interface MixProps { rows: MixRow[]; names: { a: string; b: string } }

const pct = (v: number) => `${Math.round(v)}%`;

export function MixView({ rows, names }: MixProps) {
  return <section className="cmp-mix" aria-label="Why the rankings differ">
    <h3 className="cmp-h3">Why they differ</h3>
    <p className="cmp-mix-lead">{mixLead(rows, names)}</p>
    <Stacked rows={rows} names={names} />
  </section>;
}

/** Each ranking's whole mix as one bar cut into its benchmarks, biggest first. */
function Stacked({ rows, names }: MixProps) {
  const bar = (k: "a" | "b") => {
    const r = rows.filter((x) => x[k] > 0).sort((x, y) => y[k] - x[k]);
    return <div className={`cmp-stack cmp-${k}`} role="img" aria-label={`${names[k]}: ${r.map((x) => `${x.name} ${pct(x[k])}`).join(", ")}`}>
      {r.map((x, i) => <span key={x.id} className="cmp-seg-block" style={{ flexGrow: x[k], opacity: Math.max(0.28, 1 - i * 0.14) }} title={`${x.name}: ${pct(x[k])}`}><span>{x[k] >= 12 ? x.name : ""}</span></span>)}
    </div>;
  };
  return <div className="cmp-stacked">
    <p className="cmp-stack-name cmp-a"><i aria-hidden="true" />{names.a}</p>{bar("a")}
    <p className="cmp-stack-name cmp-b"><i aria-hidden="true" />{names.b}</p>{bar("b")}
    <p className="cap cmp-same">Each bar is a ranking&apos;s whole mix. Hover a block for its benchmark.</p>
  </div>;
}
