"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { IndexConfig } from "@/engine";
import { encodeIndices } from "@/lib/url";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authEnabled } from "@/app/providers";
import { SHARE_DESIGNS } from "@/lib/share-designs";

const iconClass = "h-3.5 w-3.5 shrink-0";

function XLogo() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass} fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.657l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" /></svg>;
}

function CopyIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="8" y="8" width="11" height="11" rx="1.5" /><path d="M16 8V6.5A1.5 1.5 0 0 0 14.5 5h-9A1.5 1.5 0 0 0 4 6.5v9A1.5 1.5 0 0 0 5.5 17H8" /></svg>;
}

function DownloadIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={iconClass} fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v11m-4-4 4 4 4-4M5 19h14" /></svg>;
}

function CloseIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

type ShareProps = { indices: IndexConfig[]; active: IndexConfig; date: string; profile?: { handle: string; displayName: string } };
export function ShareCards(props: ShareProps) {
  return authEnabled && !props.profile ? <SignedShareCards {...props} /> : <ShareCardsContent {...props} />;
}
function SignedShareCards(props: ShareProps) {
  const { isAuthenticated } = useConvexAuth();
  const mine = useQuery(api.profiles.mine, isAuthenticated ? {} : "skip");
  return <ShareCardsContent {...props} profile={mine ?? undefined} />;
}
function ShareCardsContent({ indices, active, date, profile }: ShareProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useId();
  const [open, setOpen] = useState(false);
  const [design, setDesign] = useState<string>(SHARE_DESIGNS[0].id);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("");
  const [loaded, setLoaded] = useState("");
  const [failed, setFailed] = useState("");
  const [retry, setRetry] = useState(0);
  const [primed, setPrimed] = useState(false);
  const backdrop = useRef(false);
  const openedBefore = useRef(false);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  // Thumbnails mount only after the selected card renders once — the 12 OG
  // renders otherwise compete with the one card the user is looking at.
  useEffect(() => {
    if (!open || primed) return;
    const t = setTimeout(() => setPrimed(true), 2500);
    return () => clearTimeout(t);
  }, [open, primed]);
  const params = encodeIndices([active, ...indices.filter((i) => i.id !== active.id)]);
  params.set("date", date);
  params.set("design", design);
  if (profile) params.set("handle", profile.handle);
  const shareUrl = `${origin}/?${params}`;
  const imageParams = encodeIndices([active]);
  imageParams.set("date", date);
  if (profile) imageParams.set("handle", profile.handle);
  const imageUrl = (id: string) => `/og?${imageParams}&design=${encodeURIComponent(id)}`;
  const selectedUrl = `${imageUrl(design)}${retry ? `&retry=${retry}` : ""}`;
  const selected = SHARE_DESIGNS.find((d) => d.id === design) ?? SHARE_DESIGNS[0];
  const local = !origin || /^https?:\/\/(localhost|127\.|\[::1\])/.test(origin);
  const xParams = new URLSearchParams({ text: `${active.name} on Priors` });
  if (!local) xParams.set("url", shareUrl);
  const copy = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?${params}`); setMessage("Link copied"); }
    catch { setMessage("Copy failed. Select the link below to copy it manually."); }
  };
  const outside = (x: number, y: number) => {
    const r = dialog.current?.getBoundingClientRect();
    return !!r && (x < r.left || x > r.right || y < r.top || y > r.bottom);
  };
  return <>
    <button type="button" className="btn-quiet inline-flex items-center gap-1.5" onClick={copy} title="Copy link" aria-label="Copy link">{message === "Link copied" && !open ? "Link copied" : <><CopyIcon /><span className="hidden sm:inline">Copy link</span></>}</button>
    {!open && message.startsWith("Copy failed") && <span role="alert" className="text-xs">Copy failed. Open Card for the link.</span>}
    <button type="button" className="btn-quiet" onClick={() => { const saved = new URLSearchParams(window.location.search).get("design"); if (!openedBefore.current && SHARE_DESIGNS.some((d) => d.id === saved)) setDesign(saved!); openedBefore.current = true; setOrigin(window.location.origin); setMessage(""); dialog.current?.showModal(); setOpen(true); }}>Card</button>
    <dialog ref={dialog} aria-labelledby={heading} onClose={() => setOpen(false)}
      onPointerDown={(e) => { backdrop.current = e.target === e.currentTarget && outside(e.clientX, e.clientY); }}
      onClick={(e) => { if (backdrop.current && e.target === e.currentTarget && outside(e.clientX, e.clientY)) dialog.current?.close(); backdrop.current = false; }}
      className="m-auto w-[min(1160px,calc(100vw-24px))] max-h-[92dvh] overflow-y-auto rounded-md border hairline bg-bone p-4 sm:p-6 text-ink backdrop:bg-black/35">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div><h2 id={heading} className="text-2xl">Share card</h2><p className="text-sm text-ink-2">{active.name} · {SHARE_DESIGNS.length} designs</p></div>
        <button type="button" className="btn-quiet inline-flex items-center justify-center p-2" aria-label="Close share card" onClick={() => dialog.current?.close()}><CloseIcon /></button>
      </div>
      {open && <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
        <section className="min-w-0">
        <div className="relative aspect-[1200/630] overflow-hidden border hairline bg-white" aria-busy={loaded !== selectedUrl && failed !== selectedUrl}>
          {loaded !== selectedUrl && <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-2" role="status">{failed === selectedUrl ? "Card could not load." : "Rendering card…"}{failed === selectedUrl && <button type="button" className="btn-quiet ml-3" onClick={() => setRetry((n) => n + 1)}>Retry</button>}</div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={selectedUrl} src={selectedUrl} alt={`${selected.name} share card for ${active.name}`} width={1200} height={630} fetchPriority="high" onLoad={() => { setLoaded(selectedUrl); setPrimed(true); }} onError={() => { setFailed(selectedUrl); setPrimed(true); }} className={`relative h-full w-full object-contain ${loaded === selectedUrl ? "opacity-100" : "opacity-0"}`} />
        </div>
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">{String(SHARE_DESIGNS.findIndex((d) => d.id === design) + 1).padStart(2, "0")} / {selected.name}</p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-quiet inline-flex items-center gap-1.5 !border-black !bg-black !text-white hover:opacity-85" href={`https://twitter.com/intent/tweet?${xParams}`} target="_blank" rel="noopener noreferrer"><XLogo />Share on X</a>
            <button type="button" className="btn-quiet inline-flex items-center gap-1.5" onClick={copy}><CopyIcon />Copy link</button>
            <a className="btn-quiet inline-flex items-center gap-1.5" href={selectedUrl} download={`priors-${design}.png`}><DownloadIcon />Download</a>
          </div>
        </div>
        <p className="mb-4 text-xs text-ink-2">{local ? "Download the PNG to attach to your X draft. This local preview has no public link." : "X opens a draft with your index link. Download the PNG to attach the card."}</p>
        {message && <div className="mb-4 text-sm" role="status">{message}{message.startsWith("Copy failed") && <input aria-label="Share link" className="inp mt-2 w-full" value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} />}</div>}
        </section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-2" aria-label="Card designs">
          {SHARE_DESIGNS.map((item, n) => <button type="button" key={item.id} aria-pressed={design === item.id} aria-label={`Design ${n + 1}: ${item.name}`} onClick={() => { setDesign(item.id); setMessage(""); }} className={`overflow-hidden border text-left ${design === item.id ? "border-ink ring-1 ring-ink" : "border-hairline hover:border-grey"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {primed ? <img src={imageUrl(item.id)} alt="" width={1200} height={630} loading="lazy" className="aspect-[1200/630] w-full bg-white object-contain" /> : <span className="block aspect-[1200/630] w-full bg-white" aria-hidden="true" />}
            <span className="block px-2 py-2 text-xs">{String(n + 1).padStart(2, "0")} · {item.name}</span>
          </button>)}
        </div>
      </div>}
    </dialog>
  </>;
}
