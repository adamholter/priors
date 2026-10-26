"use client";
import { useState } from "react";

/** Copy the skill, optionally with a concrete request appended so a single paste does the job. */
export function CopySkill({ md }: { md: string }) {
  const [ask, setAsk] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const copy = async (text: string, what: string) => {
    setError("");
    try { await navigator.clipboard.writeText(text); setDone(what); setTimeout(() => setDone(null), 1600); }
    catch { setError("Could not copy. Use Download SKILL.md instead."); }
  };
  const withAsk = md.replace(/<!-- If the user pasted a request below this line, do that. -->\s*$/, "") + (ask.trim() ? `\n## Request\n\nPlease gather data to add this benchmark to my Priors page: ${ask.trim()}\n` : "");
  return (
    <div className="grid gap-3 bg-white border hairline rounded-md p-5">
      <label className="grid gap-1.5 text-[13px]">
        <span className="text-ink-2">Benchmark you want added (optional — appended to the skill so one paste does it)</span>
        <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="e.g. Vending-Bench 2 by Andon Labs, the money-over-time one" className="inp" />
      </label>
      {error && <p role="alert" className="text-[12px]">{error}</p>}
      <span role="status" className="sr-only">{done ? "Skill copied" : ""}</span>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => copy(withAsk, "prompt")}>{done === "prompt" ? "Copied" : ask.trim() ? "Copy skill + request" : "Copy skill"}</button>
        <a className="btn-quiet" href="/skill/SKILL.md" download="SKILL.md">Download SKILL.md</a>
      </div>
    </div>
  );
}
