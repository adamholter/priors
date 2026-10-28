"use client";
import type { IndexConfig } from "@/engine";
import { Wordmark } from "./Wordmark";
import { Builder } from "./Builder";
import { useCoreSnapshot } from "./use-core-snapshot";
import "./builder.css";

/** Keep the large calculation dataset out of the HTML response. */
export function BuilderLoader({ initialIndices }: { initialIndices: IndexConfig[] }) {
  const { snapshot, error, retry: load } = useCoreSnapshot();
  if (snapshot) return <Builder snapshot={snapshot} initialIndices={initialIndices} />;
  return <div className="builder min-h-screen">
    <header className="builder-header flex items-center px-4 sm:px-8 h-14 border-b hairline"><Wordmark /></header>
    <main className="builder-main grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-10 px-4 sm:px-8 py-8 max-w-[1500px]" aria-busy={!error}>
      <aside className="grid content-start gap-4"><div className="load-bar w-32 h-8" /><div className="load-bar w-full h-4" /><div className="load-bar w-4/5 h-4" /><div className="load-bar w-3/5 h-4" /></aside>
      <section className="grid content-start gap-6"><div className="load-bar w-44 h-8" /><div className="load-bar w-full h-64" /><div className="load-bar w-full h-48" /></section>
    </main>
    <div role="status" className="px-4 sm:px-8 text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={load}>Retry</button></> : "Loading benchmark data…"}</div>
  </div>;
}
