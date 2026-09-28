"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Snapshot } from "@/data/types";
import { mergeImports } from "@/lib/import";
import { presetOf, presetStyle } from "@/lib/page-presets";
import { Wordmark } from "../Wordmark";
import { IndexPage, type Profile } from "./IndexPage";

/** Render the profile identity immediately, then load calculation rows for its charts. */
export function ProfileLoader({ profile, date, version, dates, edit, leaders }: {
  profile: Profile; date: string; version: string; dates: string[]; edit: boolean;
  leaders: { name: string; score: number }[];
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/snapshot?view=core&date=${encodeURIComponent(date)}&version=${encodeURIComponent(version)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load benchmark data.");
        const payload = await response.json();
        return payload.snapshot as Snapshot;
      })
      .then((data) => {
        if (data.date !== date) throw new Error("Benchmark data changed. Please reload the page.");
        if (!controller.signal.aborted) setSnapshot(mergeImports(data, profile.imports ?? []).snapshot);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load benchmark data."); });
    return () => controller.abort();
  }, [date, version, profile.imports, retry]);
  if (snapshot) return <IndexPage profile={profile} snapshot={snapshot} dates={dates} edit={edit} />;
  const preset = presetOf(profile.theme);
  const surface = preset.bg;
  return <div className="page-root min-h-screen" data-dark={preset.dark || undefined} style={presetStyle(preset, profile.theme?.accent ?? preset.accent) as React.CSSProperties}>
    <header className="flex items-center px-4 sm:px-8 h-12 sm:min-h-14 border-b hairline" style={{ background: surface }}><Wordmark /><div className="ml-auto load-bar w-24 h-6" /></header>
    {profile.bannerUrl && <div className="page-banner-frame"><img src={profile.bannerUrl} alt="" className="page-banner" /></div>}
    <main className={`max-w-[1100px] mx-auto px-5 sm:px-8 grid gap-10 ${profile.bannerUrl ? "pb-12" : "py-8 sm:py-12"}`} aria-busy={!error}>
      <section className={`flex items-start gap-4 sm:gap-5 ${profile.bannerUrl ? "-mt-8 sm:-mt-10" : ""}`}>
        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }} /> : <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-hair-2 grid place-items-center serif text-3xl text-ink-2 shrink-0" style={{ boxShadow: `0 0 0 4px ${surface}` }}>{profile.displayName[0]}</div>}
        <div className={`grid gap-1 min-w-0 ${profile.bannerUrl ? "pt-9 sm:pt-11" : ""}`}><h1 className="text-[28px] sm:text-[34px] leading-tight">{profile.displayName}</h1><p className="text-[13px] text-grey">mypriors.com/{profile.handle}</p>{profile.bio && <p className="text-[15px] text-ink-2 mt-1">{profile.bio}</p>}</div>
      </section>
      <section><div className="flex items-center justify-between gap-3 mb-4"><h2 className="text-[21px] sm:text-[24px]">{profile.indices[0]?.name ?? "Rankings"}</h2><Link href="/" className="text-[12px] text-ink-2 underline">Build your own</Link></div>
        {leaders.length ? <ol className="grid gap-2 text-[13px]">{leaders.map((r, i) => <li key={`${i}-${r.name}`} className="grid grid-cols-[28px_minmax(0,1fr)_48px] gap-3"><span className="cap text-right">{i + 1}</span><span className="truncate">{r.name}</span><span className="num text-right">{r.score.toFixed(1)}</span></li>)}</ol> : <div className="load-bar w-full h-48" />}
      </section>
      <div className="load-bar w-full h-48" />
      <div role="status" className="text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={() => { setError(""); setRetry((n) => n + 1); }}>Retry</button></> : "Loading charts…"}</div>
    </main>
  </div>;
}
