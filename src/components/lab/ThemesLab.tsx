"use client";
import { useState } from "react";
import type { Snapshot } from "@/data/types";
import { IndexPage, type Profile } from "@/components/page/IndexPage";
import { THEME_CHOICES } from "@/lib/page-presets";
import "./lab.css";

/** Every page theme on a sample page, with edit mode available without signing in. Nothing saves. */
export function ThemesLab({ profile: initial, snapshot }: { profile: Profile; snapshot: Snapshot }) {
  const [profile, setProfile] = useState(initial);
  const [run, setRun] = useState(0);
  const current = profile.theme?.preset;
  return <div>
    <div className="ob-lab-bar" style={{ position: "relative" }}>
      <div className="ob-lab-group">
        <span className="ob-lab-label">Page theme</span>
        <div role="group" aria-label="Page theme" className="ob-lab-options">
          {THEME_CHOICES.map((t) => <button key={t.id} type="button" aria-pressed={current === t.id || current === t.pair} onClick={() => setProfile((p) => ({ ...p, theme: { ...p.theme, preset: t.id, accent: undefined, mode: undefined } }))}><span>{t.name}</span><small>{t.pair ? "light + dark" : t.dark ? "dark" : "light"}</small></button>)}
        </div>
      </div>
      <div className="ob-lab-group">
        <span className="ob-lab-label">Try it</span>
        <span className="ob-lab-check">Use “Edit page” in the header. Lab edits never save.</span>
        <button type="button" className="ob-lab-restart" onClick={() => { setProfile(initial); setRun((n) => n + 1); }}>Reset</button>
      </div>
    </div>
    <IndexPage key={run} profile={profile} snapshot={snapshot} edit={false} lab onProfileChange={setProfile} />
  </div>;
}
