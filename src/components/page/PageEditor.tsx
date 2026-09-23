"use client";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { ACCENTS, PAGE_PRESETS, presetOf } from "@/lib/page-presets";
import { SHARE_DESIGNS } from "@/lib/share-designs";
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
  const bannerRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  // Profiles claimed before names came from Google read "Someone": offer the real name.
  const googleName = user ? (user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ")) : "";
  const googlePhoto = user?.externalAccounts.find((a) => /google/.test(a.provider))?.imageUrl || (user?.hasImage ? user.imageUrl : undefined);
  const counter = useRef(1);
  const isOwner = !!mine && mine.handle === profile.handle;
  if (!isOwner) return null;

  const set = (patch: Partial<Profile>) => { onChange({ ...profile, ...patch }); setDirty(true); };
  const setSections = (sections: Section[]) => set({ sections });
  const move = (i: number, d: number) => { const s = [...profile.sections]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j], s[i]]; setSections(s); };
  const patchSection = (i: number, p: Partial<Section>) => setSections(profile.sections.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const addSection = (kind: Section["kind"]) => setSections([...profile.sections, { id: `${kind}-${(counter.current++).toString(36)}-${profile.sections.length}`, kind, indexId: kind === "rankings" || kind === "pareto" || kind === "speed" || kind === "history" || kind === "gallery" ? profile.indices[0]?.id : undefined, benchmarkId: kind === "benchmark" ? snapshot.benchmarks[0]?.id : undefined, body: kind === "text" ? "" : undefined, links: kind === "links" ? [] : undefined }]);
  const save = async () => {
    setSaving(true);
    const { displayName, bio, socials, indices, sections, theme } = profile;
    await update({ patch: { displayName, bio, socials: socials?.filter((x) => x.url && !["https://", "https://x.com/", "https://github.com/", "https://linkedin.com/in/"].includes(x.url.trim())), indices, sections, theme } });
    setSaving(false); setDirty(false); router.refresh();
  };
  const upload = async (file: File, field: "avatarStorageId" | "bannerStorageId" = "avatarStorageId") => {
    const url = await uploadUrl(); const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    const { storageId } = await res.json(); await update({ patch: { [field]: storageId } }); router.refresh();
  };
  const useGooglePhoto = async () => { if (!googlePhoto) return; set({ avatarUrl: googlePhoto }); await update({ patch: { avatarUrl: googlePhoto } }); router.refresh(); };
  const preset = presetOf(profile.theme);
  const cardQuery = profile.indices[0] ? `${encodeIndices([profile.indices[0]]).toString()}&handle=${profile.handle}` : `handle=${profile.handle}`;

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(!open)}>{open ? "Close editor" : "Edit page"}</button>
      {open && mounted && createPortal(
        <aside className="page-editor fixed top-0 right-0 bottom-0 w-[400px] max-w-full bg-white border-l hairline overflow-auto p-5 grid gap-7 content-start text-[13px] z-50 shadow-[-24px_0_60px_-30px_#1a1a1a40]" aria-label="Edit page">
          <div className="flex items-center justify-between gap-3 sticky -top-5 -mx-5 -mt-5 px-5 py-4 bg-white border-b hairline z-10"><h2 className="text-[22px]">Edit page</h2><div className="flex gap-2"><button type="button" className="btn" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : dirty ? "Save" : "Saved"}</button><button type="button" className="btn-quiet" onClick={() => setOpen(false)} aria-label="Close editor">Close</button></div></div>

          <Group title="Profile">
            <Field label="Photo"><div className="flex flex-wrap items-center gap-2">{profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}{googlePhoto && googlePhoto !== profile.avatarUrl && <button type="button" className="btn-quiet" onClick={useGooglePhoto}>Use Google photo</button>}<button type="button" className="btn-quiet" onClick={() => fileRef.current?.click()}>Upload</button><input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></div></Field>
            <Field label="Banner"><div className="flex flex-wrap items-center gap-2">{profile.bannerUrl && <img src={profile.bannerUrl} alt="" className="h-10 w-28 rounded-sm object-cover" />}<button type="button" className="btn-quiet" onClick={() => bannerRef.current?.click()}>{profile.bannerUrl ? "Replace" : "Upload"}</button>{profile.bannerUrl && <button type="button" className="btn-quiet" onClick={async () => { await update({ patch: { bannerStorageId: null } }); router.refresh(); }}>Remove</button>}<input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "bannerStorageId")} /></div><span className="cap">Wide image, about 4:1.</span></Field>
            <Field label="Name"><input value={profile.displayName} onChange={(e) => set({ displayName: e.target.value })} className="inp" />{googleName && googleName !== profile.displayName && <button type="button" className="cap text-left hover:text-ink" onClick={() => set({ displayName: googleName })}>Use {googleName}</button>}</Field>
            <Field label="Bio"><textarea value={profile.bio ?? ""} onChange={(e) => set({ bio: e.target.value })} rows={3} className="inp" placeholder="A sentence or two about how you pick models." /></Field>
            <Field label="Links">
              <div className="grid gap-1.5">
                {(profile.socials ?? []).map((s, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1.6fr_20px] gap-1.5">
                    <input value={s.label} placeholder="Label" onChange={(e) => set({ socials: profile.socials!.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} className="inp" />
                    <input value={s.url} placeholder="https://" onChange={(e) => set({ socials: profile.socials!.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)) })} className="inp" />
                    <button type="button" className="cap" aria-label="Remove link" onClick={() => set({ socials: profile.socials!.filter((_, k) => k !== i) })}>×</button>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5">{[["X", "https://x.com/"], ["GitHub", "https://github.com/"], ["LinkedIn", "https://linkedin.com/in/"], ["Website", "https://"]].filter(([l]) => !(profile.socials ?? []).some((x) => x.label === l)).map(([label, url]) => <button key={label} type="button" className="btn-quiet" onClick={() => set({ socials: [...(profile.socials ?? []), { label, url }] })}>+ {label}</button>)}</div>
              </div>
            </Field>
          </Group>

          <Group title="Look">
            <Field label="Color scheme">
              <div className="grid grid-cols-3 gap-2">{PAGE_PRESETS.map((pr) => <button key={pr.id} type="button" aria-pressed={preset.id === pr.id} onClick={() => set({ theme: { ...profile.theme, preset: pr.id, surface: undefined, accent: pr.accent } })} className={`rounded-md border p-2 text-left ${preset.id === pr.id ? "border-ink ring-1 ring-ink" : "hairline hover:border-grey"}`} style={{ background: pr.bg, color: pr.ink }}>
                <span className="flex gap-1 mb-2"><i className="h-2 w-6 rounded-sm" style={{ background: pr.accent }} /><i className="h-2 w-3 rounded-sm" style={{ background: pr.hair }} /></span><span className="text-[12px]">{pr.name}</span></button>)}</div>
            </Field>
            <Field label="Accent"><div className="flex flex-wrap items-center gap-1.5">{[preset.accent, ...ACCENTS.filter((a) => a !== preset.accent)].slice(0, 7).map((a) => <button key={a} type="button" aria-label={`Accent ${a}`} aria-pressed={(profile.theme?.accent ?? preset.accent) === a} onClick={() => set({ theme: { ...profile.theme, accent: a } })} className={`w-6 h-6 rounded-full ${(profile.theme?.accent ?? preset.accent) === a ? "ring-2 ring-offset-2 ring-ink" : ""}`} style={{ background: a }} />)}<label className="cap flex items-center gap-1.5 ml-1">custom <input type="color" value={profile.theme?.accent ?? preset.accent} onChange={(e) => set({ theme: { ...profile.theme, accent: e.target.value } })} /></label></div></Field>
          </Group>

          <Group title="Share card">
            <p className="text-ink-2">Used when your page link is shared and as the default in the Card dialog.</p>
            <div className="grid grid-cols-2 gap-2">{SHARE_DESIGNS.map((d) => { const on = (profile.theme?.cardDesign ?? "board") === d.id; return <button key={d.id} type="button" aria-pressed={on} onClick={() => set({ theme: { ...profile.theme, cardDesign: d.id } })} className={`overflow-hidden rounded-sm border text-left ${on ? "border-ink ring-1 ring-ink" : "hairline hover:border-grey"}`}><img src={`/og?${cardQuery}&design=${d.id}`} alt="" loading="lazy" className="block w-full aspect-[1200/630] object-cover bg-bone" /><span className="block px-2 py-1 text-[11.5px]">{d.name}</span></button>; })}</div>
          </Group>

          <Group title="Page sections">
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
                  {(s.kind === "rankings" || s.kind === "pareto" || s.kind === "speed" || s.kind === "history" || s.kind === "gallery") && (
                    <select value={s.indexId} onChange={(e) => patchSection(i, { indexId: e.target.value })} className="inp">{profile.indices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                  )}
                  {s.kind === "benchmark" && <select value={s.benchmarkId} onChange={(e) => patchSection(i, { benchmarkId: e.target.value })} className="inp">{snapshot.benchmarks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>}
                  {s.kind === "text" && <textarea value={s.body ?? ""} rows={4} onChange={(e) => patchSection(i, { body: e.target.value })} className="inp" placeholder="Write something." />}
                  {s.kind === "links" && <textarea value={(s.links ?? []).map((l) => `${l.label} ${l.url}`).join("\n")} rows={3} onChange={(e) => patchSection(i, { links: e.target.value.split("\n").filter(Boolean).map((line) => { const [label, ...rest] = line.trim().split(/\s+/); return { label: rest.length ? label : line.trim(), url: rest.length ? rest.join(" ") : line.trim() }; }) })} className="inp mono" placeholder={"Label https://…\none per line"} />}
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">{(["rankings", "pareto", "speed", "benchmark", "text", "links", "gallery"] as const).map((k) => <button key={k} type="button" className="btn-quiet" onClick={() => addSection(k)}>+ {k}</button>)}</div>
            </div>
          </Field>

          </Group>
          <Group title="Indices">
          <Field label="Indices">
            <p className="text-ink-2">Weights and benchmarks are edited in the builder; saving there updates this page.</p>
            <a className="btn-quiet inline-block mt-1" href={`/?${encodeIndices(profile.indices).toString()}`}>Open in builder</a>
          </Field>

          <Field label="Agent access">
            <p className="text-ink-2 mb-1.5">Give your agent the <Link href="/skill" className="text-indigo">Priors skill</Link> and this token. It can add benchmarks, change weights, and edit this page for you.</p>
            {token ? <code className="mono block break-all bg-bone border hairline rounded-sm p-2 text-[11.5px]">{token}</code> : <button type="button" className="btn-quiet" onClick={async () => setToken(await mint())}>Mint token</button>}
            {token && <p className="cap mt-1">Shown once. Minting again revokes the old token.</p>}
          </Field>
          </Group>
        </aside>, document.body)}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="grid gap-3.5 pt-1"><h3 className="text-[16px] border-b hairline pb-1.5">{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><span className="cap">{label}</span>{children}</div>;
}
