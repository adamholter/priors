"use client";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Snapshot } from "@/data/types";
import type { Profile, Section } from "./IndexPage";
import { encodeIndices } from "@/lib/url";

/**
 * Owner editor. Opens as a right-hand drawer over the live page; every change is reflected
 * immediately (optimistic) and saved on "Save". The agent skill edits the same fields via /api/agent.
 */
export function PageEditor({ profile, onChange, snapshot, editing }: { profile: Profile; onChange: (p: Profile) => void; snapshot: Snapshot; editing: boolean }) {
  const mine = useQuery(api.profiles.mine);
  const update = useMutation(api.profiles.update);
  const mint = useMutation(api.profiles.mintAgentToken);
  const uploadUrl = useMutation(api.profiles.generateUploadUrl);
  const router = useRouter();
  const [open, setOpen] = useState(editing);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const counter = useRef(1);
  const isOwner = !!mine && mine.handle === profile.handle;
  if (!isOwner) return null;

  const set = (patch: Partial<Profile>) => { onChange({ ...profile, ...patch }); setDirty(true); };
  const setSections = (sections: Section[]) => set({ sections });
  const move = (i: number, d: number) => { const s = [...profile.sections]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setSections(s); };
  const patchSection = (i: number, p: Partial<Section>) => setSections(profile.sections.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const addSection = (kind: Section["kind"]) => setSections([...profile.sections, { id: `${kind}-${(counter.current++).toString(36)}-${profile.sections.length}`, kind, indexId: kind === "rankings" || kind === "pareto" || kind === "speed" || kind === "history" ? profile.indices[0]?.id : undefined, benchmarkId: kind === "benchmark" ? snapshot.benchmarks[0]?.id : undefined, body: kind === "text" ? "" : undefined, links: kind === "links" ? [] : undefined }]);
  const save = async () => {
    setSaving(true);
    const { displayName, bio, socials, indices, sections, theme, avatarUrl } = profile;
    await update({ patch: { displayName, bio, socials, indices, sections, theme, avatarUrl } });
    setSaving(false); setDirty(false); router.refresh();
  };
  const upload = async (file: File) => {
    const url = await uploadUrl(); const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = await res.json(); await update({ patch: { avatarStorageId: storageId } }); router.refresh();
  };

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(!open)}>{open ? "Close editor" : "Edit page"}</button>
      {open && (
        <aside className="fixed top-14 right-0 bottom-0 w-[380px] bg-white border-l hairline overflow-auto p-5 grid gap-6 content-start text-[13px] z-20">
          <div className="flex items-center justify-between"><h2 className="text-[20px]">Edit page</h2><button type="button" className="btn" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button></div>

          <Field label="Name"><input value={profile.displayName} onChange={(e) => set({ displayName: e.target.value })} className="inp" /></Field>
          <Field label="Bio"><textarea value={profile.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} rows={3} className="inp" placeholder="A sentence or two." /></Field>
          <Field label="Photo"><div className="flex items-center gap-3">{profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />}<button type="button" className="btn-quiet" onClick={() => fileRef.current?.click()}>Upload</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></div></Field>

          <Field label="Links">
            <div className="grid gap-1.5">
              {(profile.socials ?? []).map((s, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.6fr_20px] gap-1.5">
                  <input value={s.label} placeholder="X" onChange={(e) => set({ socials: profile.socials!.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} className="inp" />
                  <input value={s.url} placeholder="https://x.com/you" onChange={(e) => set({ socials: profile.socials!.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} className="inp" />
                  <button type="button" className="cap" onClick={() => set({ socials: profile.socials!.filter((_, k) => k !== i) })}>×</button>
                </div>
              ))}
              <button type="button" className="btn-quiet justify-self-start" onClick={() => set({ socials: [...(profile.socials ?? []), { label: "", url: "" }] })}>Add link</button>
            </div>
          </Field>

          <Field label="Style">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">Accent <input type="color" value={profile.theme?.accent ?? "#2F4FB0"} onChange={(e) => set({ theme: { ...profile.theme, accent: e.target.value } })} /></label>
              <label className="flex items-center gap-2">Surface
                <select value={profile.theme?.surface ?? "bone"} onChange={(e) => set({ theme: { ...profile.theme, surface: e.target.value as "bone" | "white" } })} className="inp"><option value="bone">bone</option><option value="white">white</option></select>
              </label>
            </div>
          </Field>

          <Field label="Sections">
            <div className="grid gap-2">
              {profile.sections.map((s, i) => (
                <div key={s.id} className={`border hairline rounded-sm p-2.5 grid gap-1.5 ${s.hidden ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="cap w-[64px]">{s.kind}</span>
                    <input value={s.title ?? ""} placeholder="Title (optional)" onChange={(e) => patchSection(i, { title: e.target.value || undefined })} className="inp flex-1" />
                    <button type="button" className="cap" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="cap" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="cap" onClick={() => patchSection(i, { hidden: !s.hidden })} title={s.hidden ? "Show" : "Hide"}>{s.hidden ? "show" : "hide"}</button>
                    <button type="button" className="cap" onClick={() => setSections(profile.sections.filter((_, k) => k !== i))} aria-label="Remove">×</button>
                  </div>
                  {(s.kind === "rankings" || s.kind === "pareto" || s.kind === "speed" || s.kind === "history") && (
                    <select value={s.indexId} onChange={(e) => patchSection(i, { indexId: e.target.value })} className="inp">{profile.indices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  )}
                  {s.kind === "benchmark" && <select value={s.benchmarkId} onChange={(e) => patchSection(i, { benchmarkId: e.target.value })} className="inp">{snapshot.benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
                  {s.kind === "text" && <textarea value={s.body ?? ""} rows={4} onChange={(e) => patchSection(i, { body: e.target.value })} className="inp" placeholder="Write something." />}
                  {s.kind === "links" && <textarea value={(s.links ?? []).map((l) => `${l.label} ${l.url}`).join("\n")} rows={3} onChange={(e) => patchSection(i, { links: e.target.value.split("\n").filter(Boolean).map((line) => { const [label, ...rest] = line.trim().split(/\s+/); return { label: rest.length ? label : line.trim(), url: rest.length ? rest.join(" ") : line.trim() }; }) })} className="inp mono" placeholder={"Label https://…\none per line"} />}
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">{(["rankings", "pareto", "speed", "benchmark", "text", "links"] as const).map((k) => <button key={k} type="button" className="btn-quiet" onClick={() => addSection(k)}>+ {k}</button>)}</div>
            </div>
          </Field>

          <Field label="Indices">
            <p className="text-ink-2">Weights and rules are edited in the builder, then saved back here.</p>
            <a className="btn-quiet inline-block mt-1" href={`/?${encodeIndices(profile.indices).toString()}`}>Open in builder</a>
          </Field>

          <Field label="Agent access">
            <p className="text-ink-2 mb-1.5">Give your agent the <Link href="/skill" className="text-indigo">Priors skill</Link> and this token. It can add benchmarks, change weights, and edit this page for you.</p>
            {token ? <code className="mono block break-all bg-bone border hairline rounded-sm p-2 text-[11.5px]">{token}</code> : <button type="button" className="btn-quiet" onClick={async () => setToken(await mint())}>Mint token</button>}
            {token && <p className="cap mt-1">Shown once. Minting again revokes the old token.</p>}
          </Field>
        </aside>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><span className="cap">{label}</span>{children}</div>;
}
