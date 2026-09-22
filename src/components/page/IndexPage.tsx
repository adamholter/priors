"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, selectVariants, type IndexConfig } from "@/engine";
import { encodeIndices } from "@/lib/url";
import { ShareCards } from "../ShareCards";
import { Wordmark } from "../Wordmark";
import { Rankings } from "../Rankings";
import { ParetoChart } from "../chart/ParetoChart";
import { SpeedChart } from "../chart/SpeedChart";
import { BenchmarkTable } from "./BenchmarkTable";
import { DatePicker } from "../DatePicker";
import { MetricGallery } from "./MetricGallery";
import { authEnabled } from "@/app/providers";
import { PageEditor } from "./PageEditor";
import { ChartSettings } from "../chart/ChartSettings";

export interface Section {
  id: string; kind: "rankings" | "pareto" | "speed" | "benchmark" | "text" | "links" | "history" | "gallery";
  title?: string; indexId?: string; benchmarkId?: string; body?: string; links?: { label: string; url: string }[]; hidden?: boolean;
}
export interface Profile {
  _id: string; handle: string; displayName: string; avatarUrl?: string; bio?: string;
  socials?: { label: string; url: string }[]; indices: IndexConfig[]; sections: Section[];
  theme?: { accent?: string; surface?: "bone" | "white"; serif?: string; mono?: string; css?: string };
  imports?: { benchmark: Snapshot["benchmarks"][0]; rows: import("@/data/types").RawRow[] }[];
}

export function IndexPage({ profile, snapshot, dates, edit }: { profile: Profile; snapshot: Snapshot; dates: string[]; edit: boolean }) {
  const [p, setPState] = useState(profile);
  const [prevProfile, setPrevProfile] = useState(profile);
  if (profile !== prevProfile) { setPrevProfile(profile); setPState(profile); }
  const setP = setPState;
  const results = useMemo(() => new Map(p.indices.map((i) => [i.id, computeIndex(snapshot, { ...i, variants: "all" })])), [snapshot, p.indices]);
  const accent = p.theme?.accent ?? "#2F4FB0";
  const surface = p.theme?.surface === "white" ? "#FFFFFF" : "#FBFBF9";
  const builderHref = `/?${encodeIndices(p.indices).toString()}`;
  const [selected, setSelected] = useState<string | null>(null);
  // Owner-controlled theme: preset fields become scoped rules, `css` is a raw
  // stylesheet for their page. .page-root scopes everything to this page.
  const customCss = useMemo(() => sanitizeCss([
    p.theme?.serif ? `.page-root h1, .page-root h2, .page-root h3, .page-root .serif { font-family: ${p.theme.serif}, Newsreader, Georgia, serif; }` : "",
    p.theme?.mono ? `.page-root .mono, .page-root .num, .page-root code { font-family: ${p.theme.mono}, "JetBrains Mono", Menlo, monospace; }` : "",
    p.theme?.css ?? "",
  ].filter(Boolean).join("\n")), [p.theme?.serif, p.theme?.mono, p.theme?.css]);

  return (
    <div className="page-root min-h-screen" style={{ ["--indigo" as string]: accent, background: surface }}>
      {customCss && <style>{customCss}</style>}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 sm:px-8 min-h-14 py-2 border-b hairline sticky top-0 z-10" style={{ background: surface + "E6", backdropFilter: "blur(8px)" }}>
        <Wordmark />
        <span className="text-grey text-[13px]">/ {p.handle}</span>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <DatePicker current={snapshot.date} dates={dates} />
          {p.indices[0] && <ShareCards indices={p.indices} active={p.indices[0]} date={snapshot.date} profile={p} />}
          <Link href={builderHref as "/"} className="btn-quiet">Open in builder</Link>
          {authEnabled && <PageEditor profile={p} onChange={setP} snapshot={snapshot} editing={edit} />}
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-8 py-12 grid gap-14">
        <section className="flex items-start gap-5">
          {p.avatarUrl ? <img src={p.avatarUrl} alt="" className="w-16 h-16 rounded-full border hairline object-cover" /> : <div className="w-16 h-16 rounded-full bg-hair-2 grid place-items-center serif text-2xl text-ink-2">{p.displayName[0]}</div>}
          <div className="grid gap-1.5">
            <h1 className="text-[34px] leading-tight">{p.displayName}</h1>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px] text-ink-2">
              <span className="mono text-grey">mypriors.com/{p.handle}</span>
              {p.socials?.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="hover:text-ink" style={{ color: accent }}>{s.label}</a>)}
            </div>
            {p.bio && <p className="text-[15px] text-ink-2 max-w-[62ch] mt-1">{p.bio}</p>}
          </div>
        </section>

        {(p.sections.some((s) => s.kind === "gallery") ? p.sections : [...p.sections, { id: "gallery-auto", kind: "gallery" as const, indexId: p.indices[0]?.id }]).filter((s) => !s.hidden).map((s) => {
          const idx = (s.indexId ? p.indices.find((i) => i.id === s.indexId) : undefined) ?? (s.kind === "gallery" ? p.indices[0] : undefined);
          const r = idx ? results.get(idx.id) : undefined;
          const title = s.title ?? defaultTitle(s, idx?.name);
          if (s.kind === "text") return <section key={s.id} className="max-w-[68ch]">{s.title && <h2 className="text-[24px] mb-3">{s.title}</h2>}<p className="text-[15.5px] leading-[1.7] text-ink-2 whitespace-pre-wrap">{s.body}</p></section>;
          if (s.kind === "links") return <section key={s.id}>{title && <h2 className="text-[24px] mb-3">{title}</h2>}<ul className="grid gap-1.5 text-[14px]">{s.links?.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer" style={{ color: accent }}>{l.label}</a></li>)}</ul></section>;
          if (s.kind === "benchmark" && s.benchmarkId) return <section key={s.id}><h2 className="text-[24px] mb-3">{title}</h2><BenchmarkTable snapshot={snapshot} benchmarkId={s.benchmarkId} /></section>;
          if (!idx || !r) return null;
          const rankingMode = chartVariantMode(idx, "ranking"), paretoMode = chartVariantMode(idx, "pareto");
          if (s.kind === "gallery") return <section key={s.id}><h2 className="text-[24px] mb-1">{title}</h2><p className="cap mb-3">More metrics · expand a row</p><MetricGallery ranked={selectVariants(r.ranked, paretoMode)} snapshot={snapshot} labs={snapshot.labs} /></section>;
          const updateIndex = (patch: Partial<IndexConfig>) => setP({ ...p, indices: p.indices.map((i) => i.id === idx.id ? { ...i, ...patch } : i) });
          const excludedIds = new Set(idx.excludeModels ?? []);
          const pickerModels = (() => {
            const col = new Map(snapshot.labs.map((l) => [l.id, l.color]));
            const seen = new Map<string, { id: string; name: string; color?: string }>();
            for (const v of r.ranked) if (!seen.has(v.model.id)) seen.set(v.model.id, { id: v.model.id, name: v.model.name, color: col.get(v.model.labId) });
            for (const id of idx.excludeModels ?? []) if (!seen.has(id)) { const m = snapshot.models.find((x) => x.id === id); if (m) seen.set(id, { id, name: m.name, color: col.get(m.labId) }); }
            return [...seen.values()];
          })();
          const toggleModel = (id: string) => { const s = new Set(idx.excludeModels ?? []); if (s.has(id)) s.delete(id); else s.add(id); updateIndex({ excludeModels: s.size ? [...s] : [] }); };
          const settings = (label: string, mode: "all" | "best", key: "rankingVariants" | "paretoVariants") => <ChartSettings label={label} mode={mode} onChange={(v) => updateIndex({ [key]: v })} releasedAfter={idx.releasedAfter} onChangeReleased={(v) => updateIndex({ releasedAfter: v })} models={pickerModels} excluded={excludedIds} onToggleModel={toggleModel} onShowAllModels={() => updateIndex({ excludeModels: [] })} onHideAllModels={() => updateIndex({ excludeModels: pickerModels.map((m) => m.id) })} />;
          if (s.kind === "rankings") return (
            <section key={s.id}>
              <div className="flex items-baseline justify-between mb-3"><h2 className="text-[24px]">{title}</h2>{settings("Ranking", rankingMode, "rankingVariants")}</div>
              <Rankings ranked={selectVariants(r.ranked, rankingMode)} showEffort={rankingMode === "all"} labs={snapshot.labs} limit={25} selected={selected} onSelect={(x) => setSelected(x?.variant.id ?? null)} />
            </section>
          );
          if (s.kind === "pareto") return <section key={s.id}><div className="flex items-baseline justify-between mb-1"><h2 className="text-[24px]">{title}</h2>{settings("Pareto", paretoMode, "paretoVariants")}</div><ParetoChart ranked={selectVariants(r.ranked, paretoMode)} labs={snapshot.labs} height={440} /></section>;
          if (s.kind === "speed") return <section key={s.id}><div className="flex items-baseline justify-between mb-1"><h2 className="text-[24px]">{title}</h2><span className="cap">output tokens per second</span></div><SpeedChart ranked={r.ranked} labs={snapshot.labs} /></section>;
          if (s.kind === "history") return <section key={s.id}><h2 className="text-[24px] mb-2">{title}</h2><p className="cap">Use the date picker above to view this page as of any earlier snapshot.</p></section>;
          return null;
        })}

        <footer className="border-t hairline pt-6 flex items-baseline justify-between text-[12.5px] text-grey">
          <span>Data as of {snapshot.date}. Sources: {[...new Set(snapshot.benchmarks.map((b) => b.sourceId))].join(", ")}.</span>
          <Link href="/" className="hover:text-ink">Build your own</Link>
        </footer>
      </main>
    </div>
  );
}

/** Owner CSS: their page, their rules — but block style-tag breakout and JS URLs. */
function sanitizeCss(css: string) {
  return css.replace(/<\//g, "<\\/").replace(/expression\s*\(|javascript\s*:/gi, "blocked").slice(0, 10_000);
}

function defaultTitle(s: Section, indexName?: string) {
  switch (s.kind) {
    case "rankings": return indexName ?? "Rankings";
    case "pareto": return `${indexName ?? "Score"} vs cost per task`;
    case "speed": return `${indexName ?? "Score"} vs speed`;
    case "history": return `${indexName ?? "Frontier"} over time`;
    case "gallery": return "More metrics";
    case "benchmark": return "Benchmark";
    case "links": return "Links";
    default: return "";
  }
}
