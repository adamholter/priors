import Link from "next/link";
import { LabLogo } from "@/components/LabLogo";
import type { LabSummary } from "@/lib/lab-page";
import { labPath } from "@/lib/lab-path";
import "@/components/model/models.css";
import "./labs.css";

/** Every lab with a model Priors has results for: its best rank on the default ranking, its best model, how many models it has, and how many benchmarks it leads. */
export function LabList({ labs, indexName }: { labs: LabSummary[]; indexName: string }) {
  return (
    <div className="lab-page">
      <div className="lab-list-head cap" aria-hidden="true"><span>Rank</span><span>Lab</span><span>Best model</span><span>Models</span><span>Ranked</span><span>First on</span></div>
      <ul className="lab-list" aria-label="Labs">
        {labs.map((l) => (
          <li key={l.id}>
            <Link href={labPath(l.id) as "/"} prefetch={false} className="lab-row" title={l.best ? `#${l.best.rank} on ${indexName}` : `No model ranked on ${indexName}`}>
              <span className="num lab-row-rank">{l.best ? `#${l.best.rank}` : ""}</span>
              <span className="lab-row-name"><LabLogo lab={l.id} name={l.name} color={l.color} size={20} /><span className="md-trunc">{l.name}</span></span>
              <span className="lab-row-best md-trunc">{l.best?.name ?? ""}</span>
              <span className="num lab-row-models">{l.models}</span>
              <span className="num">{l.ranked}</span>
              <span className="num lab-row-leads" title="Benchmarks where its best model beats every other lab's best">{l.leads || ""}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
