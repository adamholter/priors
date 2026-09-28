"use client";
import { useCallback, useEffect, useState } from "react";
import type { Snapshot } from "@/data/types";
import type { IndexConfig } from "@/engine";
import { Wordmark } from "./Wordmark";
import { Builder } from "./Builder";

/** Keep the large calculation dataset out of the HTML response. */
export function BuilderLoader({ date, version, dates, initialIndices }: { date?: string; version: string; dates: string[]; initialIndices: IndexConfig[] }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const load = useCallback(() => { setError(""); setRetry((n) => n + 1); }, []);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ view: "core", version });
    if (date) query.set("date", date);
    fetch(`/api/snapshot?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load benchmark data.");
        const payload = await response.json();
        return payload.snapshot as Snapshot;
      })
      .then((data) => { if (!controller.signal.aborted) setSnapshot(data); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load benchmark data."); });
    return () => controller.abort();
  }, [date, version, retry]);
  if (snapshot) return <Builder snapshot={snapshot} dates={dates} initialIndices={initialIndices} />;
  return <div className="min-h-screen">
    <header className="flex items-center px-4 sm:px-8 h-14 border-b hairline"><Wordmark /></header>
    <main className="grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-10 px-4 sm:px-8 py-8 max-w-[1500px]" aria-busy={!error}>
      <aside className="grid content-start gap-4"><div className="load-bar w-32 h-8" /><div className="load-bar w-full h-4" /><div className="load-bar w-4/5 h-4" /><div className="load-bar w-3/5 h-4" /></aside>
      <section className="grid content-start gap-6"><div className="load-bar w-44 h-8" /><div className="load-bar w-full h-64" /><div className="load-bar w-full h-48" /></section>
    </main>
    <div role="status" className="px-4 sm:px-8 text-[12px] text-grey">{error ? <>{error} <button type="button" className="underline" onClick={load}>Retry</button></> : "Loading benchmark data…"}</div>
  </div>;
}
