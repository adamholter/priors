"use client";
import { useEffect, useState } from "react";
import { readCoreSnapshot } from "@/data/packed-snapshot";
import type { Snapshot } from "@/data/types";

export function SourceStatus({ snapshot, onSnapshot }: { snapshot: Snapshot; onSnapshot: (s: Snapshot) => void }) {
  const [canRefresh, setCanRefresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checked, setChecked] = useState("");
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const response = await fetch("/api/snapshot?view=meta", { cache: "no-store" });
        if (!response.ok) throw new Error("Could not check for updated data.");
        const data = await response.json();
        if (!active) return;
        setError("");
        setCanRefresh(data.canRefresh);
        setBusy(data.refreshing);
        if (data.generatedAt !== snapshot.generatedAt) {
          const updated = await fetch(`/api/snapshot?view=core&packed=1&version=${encodeURIComponent(data.generatedAt)}`, { cache: "no-store" });
          if (!updated.ok) throw new Error("Could not load updated data.");
          const fresh = await readCoreSnapshot(updated);
          if (active) onSnapshot(fresh);
        }
        setChecked(new Date(snapshot.generatedAt).toLocaleString());
      } catch { if (active) setError("Could not check for updated data."); }
    };
    void poll();
    const timer = setInterval(poll, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, [snapshot.generatedAt, onSnapshot]);
  const refresh = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/snapshot", { method: "POST", headers: { "x-priors-refresh": "1" } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.snapshot) onSnapshot(data.snapshot);
    } catch (e) { setError(e instanceof Error ? e.message : "Refresh failed."); }
    finally { setBusy(false); }
  };
  return (
    <details className="mt-4 text-[12px] text-ink-2">
      <summary className="cap cursor-pointer">Sources · {checked || snapshot.date}</summary>
      <div className="grid gap-2 mt-3">
        {canRefresh && <button className="btn-quiet" disabled={busy} onClick={refresh}>{busy ? "Scraping live sources…" : "Refresh sources"}</button>}
        <p className="cap">Local scrapers check the source sites. Open pages check for new snapshots every minute.</p>
        {error && <p role="alert">{error}</p>}
        {snapshot.sources.map((s) => <div key={s.sourceId} className="grid gap-0.5">
          <span>{s.sourceId} · {s.status} · {s.rowCount} source rows</span>
          <span className="cap">Fetched {s.fetchedAt.replace("T", " ").slice(0, 19)} UTC{s.unknownLabels.length ? ` · ${s.unknownLabels.length} unmatched labels` : ""}</span>
          {s.error && <span role="alert">Refresh failed; any retained scores are from an earlier run.</span>}
        </div>)}
      </div>
    </details>
  );
}
