"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Snapshot } from "@/data/types";
import { Wordmark } from "@/components/Wordmark";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { HeaderAccount } from "@/components/AccountMenu";
import { SettingsButton } from "@/components/SiteSettings";
import { Compare, compareHref, type PickerStyle, type SummaryStyle } from "@/components/compare/Compare";
import type { MixStyle } from "@/components/compare/mix-views";
import { choiceFromIndex, choiceFromPage, choiceFromPreset, rankSide, type Choice, type PageData, type Published } from "@/components/compare/choice";
import { loadPage as loadPublishedPage } from "@/components/compare/load-page";
import type { Sources } from "@/components/compare/SidePicker";
import { ExploreCard, type ExploreCardData } from "@/components/explore/ExploreCard";
import { PRESET_IDS } from "@/lib/compare-ref";
import { decodeIndex } from "@/lib/url";
import "@/components/compare/compare.css";
import "./compare-lab.css";

const mix = (id: string, s: string) => decodeIndex(s, id)!;
const PEOPLE: PageData[] = [
  { handle: "maya", displayName: "Maya Chen", indices: [mix("m1", "Ship code|terminalbench-4:30,bh-swe-bench-pro-public:30,deepswe-1.1:20,bh-cursorbench-4.0:20"), mix("m2", "Agents|aa-tau2-bench:40,terminalbench-4:30,aa-terminalbench-hard:30")] },
  { handle: "tommaso", displayName: "Tommaso", indices: [mix("t1", "Knowledge first|aa-gpqa-diamond:30,aa-humanitys-last-exam:30,aa-mmlu-pro:20,aa-omniscience:20")] },
  { handle: "dev", displayName: "Dev Patel", indices: [mix("d1", "Hard reasoning|aa-humanitys-last-exam:40,aa-critpt:30,aa-gpqa-diamond:30")] },
  { handle: "lena", displayName: "Lena K", indices: [mix("l1", "Everyday|aa-ifbench:30,aa-mmlu-pro:30,aa-livecodebench:20,aa-omniscience-accuracy:20")] },
];
const SAMPLE_PUBLISHED: Published[] = PEOPLE.map((p) => ({ handle: p.handle, displayName: p.displayName, indexName: p.indices[0].name }));

const SUMMARIES: { id: SummaryStyle; label: string; note: string }[] = [
  { id: "sentence", label: "A · Sentence", note: "Headline, then numbers" },
  { id: "scoreboard", label: "B · Scoreboard", note: "Three big numbers" },
  { id: "minimal", label: "C · One line", note: "No stats" },
];
const PICKERS: { id: PickerStyle; label: string; note: string }[] = [
  { id: "popover", label: "A · Menu", note: "Opens under the card" },
  { id: "strip", label: "B · Faces", note: "Row of people under the cards" },
  { id: "sheet", label: "C · Sheet", note: "Centered dialog" },
];
const MIXES: { id: MixStyle; label: string; note: string }[] = [
  { id: "grouped", label: "A · Grouped", note: "Only A, only B, or both" },
  { id: "pull", label: "B · Pull", note: "One bar toward who weighs more" },
  { id: "stacked", label: "C · Stacked", note: "Each whole mix as one bar" },
];

function Group<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { id: T; label: string; note: string }[] }) {
  return <div className="cmp-lab-group"><span className="cap">{label}</span><div className="cmp-lab-options" role="group" aria-label={label}>{options.map((o) => <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}><span>{o.label}</span><small>{o.note}</small></button>)}</div></div>;
}

/** The compare view with every open design question switchable, on sample people and today's data. */
export function CompareLab({ snapshot, published, initialA, initialB }: { snapshot: Snapshot; published: Published[]; initialA?: Choice; initialB?: Choice }) {
  const [summary, setSummary] = useState<SummaryStyle>("sentence");
  const [picker, setPicker] = useState<PickerStyle>("popover");
  const [mixStyle, setMixStyle] = useState<MixStyle>("grouped");
  const you = useMemo(() => choiceFromPreset(snapshot, "aa")!, [snapshot]);
  const mineChoice = useMemo(() => choiceFromIndex(you.config, { title: "You", short: "you", mine: true }), [you]);
  const [a, setA] = useState<Choice | undefined>(initialA ?? mineChoice);
  const [b, setB] = useState<Choice | undefined>(initialB ?? choiceFromPage(PEOPLE[0], undefined));
  const [top, setTop] = useState(10), [same, setSame] = useState(false);
  const labs = useMemo(() => new Map(snapshot.labs.map((l) => [l.id, l.color])), [snapshot]);
  const loadPage = useMemo(() => async (handle: string): Promise<PageData | null> => PEOPLE.find((p) => p.handle === handle) ?? (await loadPublishedPage(handle).catch(() => null)), []);
  const sources = useMemo<Sources>(() => ({
    builder: [], published: [...SAMPLE_PUBLISHED, ...published.filter((p) => !PEOPLE.some((x) => x.handle === p.handle))], loadPage,
    page: { handle: "you", displayName: "You", indices: [you.config, mix("y2", "Coding only|terminalbench-4:50,bh-swe-bench-pro-public:50")] },
    presets: PRESET_IDS.map((id) => choiceFromPreset(snapshot, id)).filter((c): c is Choice => !!c),
  }), [snapshot, published, loadPage, you]);
  useEffect(() => { history.replaceState(null, "", compareHref(a, b).replace("/compare", "/lab/compare")); }, [a, b]);
  const cards = useMemo<(ExploreCardData & { choice: Choice })[]>(() => PEOPLE.map((p) => {
    const choice = choiceFromPage(p)!;
    const s = rankSide(snapshot, choice);
    const benches = [...s.result.benchmarks].sort((x, y) => y.share - x.share);
    return { choice, handle: p.handle, name: p.displayName, when: "today", index: choice.sub, others: p.indices.slice(1).map((i) => i.name), more: p.indices.length - 1, count: benches.length,
      mix: benches.slice(0, 3).map((x) => ({ name: x.benchmark.shortName ?? x.benchmark.name, share: Math.round(x.share) })),
      top: s.placed.slice(0, 3).map((m) => ({ name: m.name, score: m.score, labId: m.labId, base: labs.get(m.labId) ?? "#A3A39B" })),
      pageHref: "/lab/compare", remixHref: "/lab/compare", compareHref: "/lab/compare" };
  }), [snapshot, labs]);
  const toCompare = () => document.getElementById("cmp-lab-compare")?.scrollIntoView({ behavior: "smooth" });
  return <div className="cmp-lab">
    <div className="cmp-lab-bar">
      <span className="cmp-lab-title">Compare lab</span>
      <Group label="Summary" value={summary} onChange={setSummary} options={SUMMARIES} />
      <Group label="Choosing" value={picker} onChange={setPicker} options={PICKERS} />
      <Group label="Why they differ" value={mixStyle} onChange={setMixStyle} options={MIXES} />
    </div>
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline">
      <div className="flex items-center gap-5"><Wordmark /><span className="max-sm:hidden"><SiteNav /></span></div>
      <span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span>
    </header>
    <div className="max-w-[1100px] mx-auto px-4 sm:px-8 py-8">
      <section className="cmp-lab-explore" aria-label="Explore, sample">
        <p className="cap cmp-lab-label">Explore, sample people. Compare puts you on the left and them on the right.</p>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => <div key={c.handle} role="presentation" onClickCapture={(e) => { const link = (e.target as HTMLElement).closest("a"); if (!link) return; e.preventDefault(); if (link.textContent?.includes("Compare")) { setA(mineChoice); setB(c.choice); toCompare(); } }}><ExploreCard c={c} /></div>)}
        </ul>
      </section>
      <div id="cmp-lab-compare"><h1 className="text-[36px] leading-tight mb-6">Compare</h1>
        <Compare snapshot={snapshot} a={a} b={b} onA={setA} onB={setB} sources={sources} top={top} onTop={setTop} same={same} onSame={setSame} onSwap={() => { setA(b); setB(a); }} labs={labs} summary={summary} picker={picker} mixStyle={mixStyle} /></div>
    </div>
    <SiteFooter />
    <p className="cap cmp-lab-foot"><Link href="/compare?a=me">Live version</Link></p>
  </div>;
}
