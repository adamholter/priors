"use client";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { IMAGE_ACCEPT, useImageUpload } from "../useImageUpload";
import { ACCENTS, THEME_CHOICES, pickerThemeOf, presetOf, type PagePreset } from "@/lib/page-presets";
import { ExploreThemes } from "../ExploreThemes";
import { ThemeSwatch } from "../ThemeSwatch";
import { SHARE_DESIGNS } from "@/lib/share-designs";
import { api } from "../../../convex/_generated/api";
import type { Profile } from "./IndexPage";
import { encodeIndices, PAGE_KEY, pageRef, prettyQuery } from "@/lib/url";
import { authEnabled } from "@/app/providers";


/**
 * Page settings drawer, opened from the edit bar. Everything on the page itself is edited inline;
 * this holds what has no place on the page: theme, share card, photo/banner/links and agent access.
 * Changes apply live and autosave with the rest of the page.
 */
export function PageSettings({ profile, set, open, onClose, lab }: { profile: Profile; set: (patch: Partial<Profile>) => void; open: boolean; onClose: () => void; lab?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, []);
  // "Open in builder" marks each index with its page index, good for this tab only (see FromPage in url.ts).
  const [pageKey] = useState(() => crypto.randomUUID().replace(/-/g, ""));
  if (!open || !mounted) return null;
  const chosen = presetOf(profile.theme);
  const family = pickerThemeOf(chosen.id) ?? chosen;
  const setTheme = (t: PagePreset) => set({ theme: { ...profile.theme, preset: t.id, surface: undefined, accent: undefined, ...(!t.pair ? { mode: undefined } : t.dark ? { mode: "fixed" } : {}) } });
  const lightDark = chosen.pair ? <div className="seg w-fit" role="group" aria-label="Light and dark">
            <button type="button" aria-pressed={profile.theme?.mode !== "fixed"} onClick={() => set({ theme: { ...profile.theme, preset: family.id, mode: undefined } })}>Follow visitor</button>
            <button type="button" aria-pressed={profile.theme?.mode === "fixed" && !chosen.dark} onClick={() => set({ theme: { ...profile.theme, preset: chosen.dark ? chosen.pair : chosen.id, mode: "fixed" } })}>Always light</button>
            <button type="button" aria-pressed={profile.theme?.mode === "fixed" && chosen.dark} onClick={() => set({ theme: { ...profile.theme, preset: chosen.dark ? chosen.id : chosen.pair, mode: "fixed" } })}>Always dark</button>
          </div> : null;
  const cardQuery = lab ? encodeIndices(profile.indices.slice(0, 1)).toString() : profile.indices[0] ? `${encodeIndices([profile.indices[0]]).toString()}&handle=${profile.handle}` : `handle=${profile.handle}`;
  return createPortal(
    <aside className="page-editor fixed top-0 right-0 bottom-0 w-[400px] max-w-full bg-white border-l hairline overflow-auto p-5 grid gap-7 content-start text-[13px] z-50 shadow-[-24px_0_60px_-30px_var(--shadow)]" aria-label="Page settings">
      <div className="flex items-center justify-between gap-3 sticky -top-5 -mx-5 -mt-5 px-5 py-4 bg-white border-b hairline z-10"><h2 className="text-[22px]">Page settings</h2><button type="button" className="btn-quiet" onClick={onClose}>Done</button></div>

      <Group title="Theme">
        <div className="grid grid-cols-2 gap-2">{THEME_CHOICES.map((t) => <ThemeSwatch key={t.id} theme={t} selected={family.id === t.id} onClick={() => setTheme(t)} />)}</div>
        <ExploreThemes selectedId={family.library ? family.id : undefined} onPick={setTheme} modeControl={lightDark && <div className="theme-mode-row"><span className="theme-mode-label">Light and dark</span>{lightDark}</div>} />
        {lightDark && <Field label="Light and dark">{lightDark}</Field>}
        <Field label="Accent"><div className="flex flex-wrap items-center gap-1.5">{[chosen.accent, ...ACCENTS.filter((a) => a !== chosen.accent)].slice(0, 9).map((a) => <button key={a} type="button" aria-label={`Accent ${a}`} aria-pressed={(profile.theme?.accent ?? chosen.accent) === a} onClick={() => set({ theme: { ...profile.theme, accent: a === chosen.accent ? undefined : a } })} className={`w-6 h-6 rounded-full ${(profile.theme?.accent ?? chosen.accent) === a ? "ring-2 ring-offset-2 ring-ink" : ""}`} style={{ background: a }} />)}</div></Field>
      </Group>

      <Group title="Share card">
        <p className="text-ink-2">Used when your page link is shared and as the default when you share a card. It follows your page theme.</p>
        <div className="grid grid-cols-2 gap-2">{SHARE_DESIGNS.map((d) => { const on = (profile.theme?.cardDesign ?? SHARE_DESIGNS[0].id) === d.id; return <button key={d.id} type="button" aria-pressed={on} onClick={() => set({ theme: { ...profile.theme, cardDesign: d.id } })} className={`overflow-hidden rounded-sm border text-left ${on ? "border-ink ring-1 ring-ink" : "hairline hover:border-grey"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/og?${cardQuery}&design=${d.id}&theme=${encodeURIComponent(chosen.id)}`} alt="" loading="lazy" className="aspect-[1200/630] w-full object-cover bg-hair-2" /><span className="block px-2 py-1.5 text-[11.5px]">{d.name}</span></button>; })}</div>
      </Group>

      <Group title="Profile">
        <p className="text-ink-2">Name, bio and section titles are edited right on the page.</p>
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
        {authEnabled && !lab ? <MediaFields profile={profile} set={set} /> : <p className="cap">Photo, banner and agent access are available on your live page.</p>}
      </Group>

      <Group title="Indices">
        <p className="text-ink-2">Weights and benchmarks are edited in the builder; saving there updates this page.</p>
        <a className="btn-quiet inline-block w-fit" href={`/builder?${prettyQuery(encodeIndices(lab ? profile.indices : profile.indices.map((i) => ({ ...i, page: pageRef(profile.handle, i.id, pageKey) })), true))}`} onClick={() => { try { sessionStorage.setItem(PAGE_KEY, pageKey); } catch { /* storage can be disabled */ } }}>Open in builder</a>
      </Group>

      {authEnabled && !lab && <DeletePage handle={profile.handle} />}
    </aside>, document.body);
}

/** Deleting is for good, so the owner types the handle first. Talks to Convex, so it only mounts for the signed-in owner. */
function DeletePage({ handle }: { handle: string }) {
  const remove = useMutation(api.profiles.remove);
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const sure = typed.trim().toLowerCase() === handle;
  const run = async () => {
    setState("busy");
    try {
      await remove({ handle });
      try { localStorage.removeItem("priors:handle"); } catch { /* storage can be disabled */ }
      // A full load: every open query still points at the page that is gone.
      window.location.assign("/builder");
    } catch (e) { console.error("Page delete failed", e); setState("error"); }
  };
  return <Group title="Delete page">
    <p className="text-ink-2">This removes your page, its imported benchmarks and its images for good, and takes it off Explore. mypriors.com/{handle} becomes free for anyone to claim.</p>
    <Field label={`Type ${handle} to confirm`}>
      <div className="flex flex-wrap items-center gap-2">
        <input value={typed} onChange={(e) => setTyped(e.target.value)} className="inp w-44" aria-label={`Type ${handle} to confirm`} autoComplete="off" spellCheck={false} />
        <button type="button" className="btn-quiet" disabled={!sure || state === "busy"} onClick={run}>{state === "busy" ? "Deleting…" : "Delete page"}</button>
      </div>
    </Field>
    {state === "error" && <p role="alert">Couldn’t delete the page. Try again.</p>}
  </Group>;
}

/** Uploads and the agent token talk to Convex directly, so they only mount for the signed-in owner. */
function MediaFields({ profile, set }: { profile: Profile; set: (patch: Partial<Profile>) => void }) {
  const update = useMutation(api.profiles.update);
  const mint = useMutation(api.profiles.mintAgentToken);
  const router = useRouter();
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const googleName = user ? (user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ")) : "";
  const googlePhoto = user?.externalAccounts.find((a) => /google/.test(a.provider))?.imageUrl || (user?.hasImage ? user.imageUrl : undefined);
  const { upload, error: uploadError } = useImageUpload();
  return <>
    {googleName && googleName !== profile.displayName && <button type="button" className="cap text-left hover:text-ink" onClick={() => set({ displayName: googleName })}>Use the name {googleName}</button>}
    <Field label="Photo"><div className="flex flex-wrap items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {profile.avatarUrl && <img src={profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />}
      {googlePhoto && googlePhoto !== profile.avatarUrl && <button type="button" className="btn-quiet" onClick={async () => { set({ avatarUrl: googlePhoto }); await update({ patch: { avatarUrl: googlePhoto } }); router.refresh(); }}>Use Google photo</button>}
      <button type="button" className="btn-quiet" onClick={() => fileRef.current?.click()}>Upload</button>
      <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div></Field>
    <Field label="Banner"><div className="flex flex-wrap items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {profile.bannerUrl && <img src={profile.bannerUrl} alt="" className="h-10 w-40 rounded-sm object-cover" />}
      <button type="button" className="btn-quiet" onClick={() => bannerRef.current?.click()}>{profile.bannerUrl ? "Replace" : "Upload"}</button>
      {profile.bannerUrl && <button type="button" className="btn-quiet" onClick={async () => { await update({ patch: { bannerStorageId: null } }); router.refresh(); }}>Remove</button>}
      <input ref={bannerRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "banner")} />
    </div></Field>
    {uploadError && <p role="alert">{uploadError}</p>}
    <Field label="Agent access">
      <p className="text-ink-2 mb-1.5">Give your agent the <Link href="/skill" className="text-indigo">Priors skill</Link> and this token. It can add benchmarks, change weights, and edit this page for you.</p>
      {token ? <code className="ph-no-capture mono block break-all bg-bone border hairline rounded-sm p-2 text-[11.5px]">{token}</code> : <button type="button" className="btn-quiet w-fit" onClick={async () => setToken(await mint())}>Mint token</button>}
      {token && <p className="cap mt-1">Shown once. Minting again revokes the old token.</p>}
    </Field>
  </>;
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="grid gap-3.5 pt-1"><h3 className="text-[16px] border-b hairline pb-1.5">{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><span className="cap">{label}</span>{children}</div>;
}
