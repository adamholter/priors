"use client";
import Link from "next/link";
import { SettingsButton } from "@/components/SiteSettings";
import { useState } from "react";
import { Wordmark } from "@/components/Wordmark";
import { importSchema, type ImportPayload } from "@/lib/import";
import { normalizeLabel } from "@/data/normalize";
import { authEnabled } from "@/app/providers";
import { PageTransition } from "@/components/PageTransition";
import { ImportSave } from "./ImportSave";

export const LOCAL_KEY = "priors:imports";

/** Paste or upload the JSON an agent (or you) produced. Saves to your page when signed in, otherwise to this browser. */
export default function ImportPage() {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ImportPayload | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [savedLocal, setSavedLocal] = useState(false);

  const validate = (t: string) => {
    setText(t); setParsed(null); setSavedLocal(false);
    if (!t.trim()) return setIssues([]);
    try { const r = importSchema.safeParse(JSON.parse(t)); if (r.success) { setParsed(r.data); setIssues([]); } else setIssues(r.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "root"}: ${i.message}`)); }
    catch (e) { setIssues([`Not valid JSON: ${(e as Error).message}`]); }
  };
  const unknown = parsed ? parsed.rows.filter((r) => !normalizeLabel(r.modelLabel, r.effort).ok).map((r) => r.modelLabel) : [];
  const saveLocal = () => { if (!parsed) return; const cur = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as ImportPayload[]; localStorage.setItem(LOCAL_KEY, JSON.stringify([...cur.filter((c) => c.benchmark.id !== parsed.benchmark.id), parsed])); setSavedLocal(true); };

  return (
    <PageTransition><main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark transitionTypes={["nav-back"]} /><Link href="/builder" transitionTypes={["nav-back"]} className="text-grey text-[13px] hover:text-ink">Builder</Link><Link href="/skill" transitionTypes={["nav-forward"]} className="text-grey text-[13px] hover:text-ink">Skill</Link><span className="ml-auto"><SettingsButton /></span></header>
      <div className="max-w-[820px] mx-auto px-8 py-12 grid gap-6">
        <div><h1 className="text-[36px] mb-3">Import a benchmark</h1><p className="text-[16px] text-ink-2 max-w-[62ch]">Paste the JSON your agent produced with the <Link href="/skill" transitionTypes={["nav-forward"]} className="text-indigo">Priors skill</Link>, or drop the file. Model names are matched to the models already on the site; anything unrecognized is listed so you can fix it.</p></div>
        <div className="grid gap-2">
          <textarea value={text} onChange={(e) => validate(e.target.value)} rows={12} spellCheck={false} placeholder='{ "benchmark": { … }, "rows": [ … ] }' className="inp mono text-[12.5px]" onDrop={async (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) validate(await f.text()); }} onDragOver={(e) => e.preventDefault()} />
          <div className="flex items-center gap-2"><input type="file" accept="application/json,.json" onChange={async (e) => { const f = e.target.files?.[0]; if (f) validate(await f.text()); }} className="text-[12.5px]" /></div>
        </div>
        {issues.length > 0 && <ul className="grid gap-1 text-[13px]" style={{ color: "var(--danger)" }}>{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
        {parsed && (
          <div className="grid gap-3 bg-white border hairline rounded-md p-5 text-[13.5px]">
            <div><span className="text-ink font-medium">{parsed.benchmark.name}</span> <span className="cap">{parsed.benchmark.id} · {parsed.benchmark.unit} · {parsed.benchmark.category}</span></div>
            <p className="text-ink-2">{parsed.benchmark.description}</p>
            <div className="flex gap-6"><span><span className="num">{parsed.rows.length}</span> rows</span><span><span className="num">{parsed.rows.length - unknown.length}</span> matched</span>{parsed.missing?.length ? <span><span className="num">{parsed.missing.length}</span> reported missing by the agent</span> : null}</div>
            {unknown.length > 0 && <p className="text-[12.5px]" style={{ color: "var(--warn)" }}>Unrecognized model labels (ignored): {unknown.join(", ")}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {authEnabled ? <ImportSave payload={parsed} /> : null}
              <button type="button" className="btn-quiet" onClick={saveLocal}>{savedLocal ? "Saved to this browser" : "Use in this browser only"}</button>
              {savedLocal && <Link href="/builder" transitionTypes={["nav-back"]} className="text-indigo text-[13px]">Open the builder →</Link>}
            </div>
          </div>
        )}
      </div>
    </main></PageTransition>
  );
}
