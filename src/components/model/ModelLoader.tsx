"use client";
import Link from "next/link";
import { HeaderAccount } from "@/components/AccountMenu";
import { SiteFooter } from "@/components/SiteFooter";
import { SettingsButton } from "../SiteSettings";
import { SiteNav } from "../SiteNav";
import { Wordmark } from "../Wordmark";
import { useCoreSnapshot } from "../use-core-snapshot";
import { ModelPage } from "./ModelPage";

/**
 * The model page without the dataset in its HTML (it was 21 MB per page): the server sends the model's name and
 * standing, and the browser loads the shared calculation dataset once for every page that needs it.
 */
export function ModelLoader({ modelId, rank, name, lab, summary }: { modelId: string; rank?: string; name: string; lab?: string; summary?: string }) {
  const { snapshot, error, retry } = useCoreSnapshot();
  if (snapshot?.models.some((m) => m.id === modelId)) return <ModelPage snapshot={snapshot} modelId={modelId} rank={rank} />;
  return <main className="min-h-screen">
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 sm:px-8 py-2 sm:h-14 border-b hairline"><div className="flex items-center gap-5"><Wordmark /><Link href="/builder" className="max-sm:hidden text-grey text-[13px] hover:text-ink">Builder</Link></div><span className="ml-auto flex items-center gap-2"><HeaderAccount /><SettingsButton /></span><span className="sm:hidden w-full"><SiteNav /></span></header>
    <div className="max-w-[1100px] mx-auto px-5 sm:px-8 py-10 grid gap-12" aria-busy={!error}>
      <section>
        {lab && <p className="cap">{lab}</p>}
        <h1 className="text-[44px] leading-[1.05] mt-2">{name}</h1>
        {summary && <p className="text-[13.5px] text-ink-2 mt-2 max-w-[70ch]">{summary}</p>}
      </section>
      <div className="grid gap-4"><div className="load-bar w-44 h-8" /><div className="load-bar w-full h-48" /><div className="load-bar w-full h-48" /></div>
      <div role="status" className="text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={retry}>Retry</button></> : "Loading benchmark data…"}</div>
    </div>
    <SiteFooter />
  </main>;
}
