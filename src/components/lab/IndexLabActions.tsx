"use client";
import { useRef, useState } from "react";
import { IconArrowRight, IconX } from "@tabler/icons-react";
import type { IndexConfig } from "@/engine";
import { encodeIndices } from "@/lib/url";
import { useTheme } from "@/components/Theme";
import { ShareMenu } from "@/components/ShareMenu";
import "./sharing-lab.css";
import "@/components/share-menu.css";

export type PublishPlacement = "inline" | "rail" | "dock";
export function IndexLabActions({ active, date, top, placement }: { active: IndexConfig; date: string; top: string[]; placement: PublishPlacement }) {
 const { dark } = useTheme();
 const dialog = useRef<HTMLDialogElement>(null);
 const [handle, setHandle] = useState(""), [preview, setPreview] = useState(false), [message, setMessage] = useState("");
 const query = encodeIndices([active]); query.set("date", date);
 const publicUrl = `https://mypriors.com/builder?${query}`;
 if (dark) query.set("scheme", "dark");
 const image = `/og?${query}`;
 return <>
  <section className={`lab-publish-panel ${placement}`} aria-label="Publish and share your index">
   <div><h3>Make this index yours.</h3><p>Publish your page on Explore.</p>{message && <p className="share-status" role="status">{message}</p>}</div>
   <div className="lab-publish-actions"><ShareMenu imageUrl={image} link={publicUrl} top={top} label="Share" onMessage={setMessage} /><button type="button" className="lab-publish-primary" onClick={() => { setPreview(false); dialog.current?.showModal(); }}>Publish to Explore <IconArrowRight size={16} /></button></div>
  </section>
  <dialog ref={dialog} className="lab-publish-dialog" aria-labelledby={`publish-${placement}`} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
   <div className="dialog-heading"><h2 id={`publish-${placement}`}>{preview ? `@${handle}` : "Claim your page."}</h2><button type="button" aria-label="Close publishing preview" onClick={() => dialog.current?.close()}><IconX size={18} /></button></div>
   <p className="cap">Lab preview. Nothing is published.</p>
   {preview ? <>
    <div className="lab-publish-preview"><p className="mono text-xs">mypriors.com/{handle}</p><h3 className="text-2xl mt-3">{active.name}</h3><ol>{top.map(n => <li key={n}>{n}</li>)}</ol></div>
    <button type="button" className="lab-publish-primary" onClick={() => dialog.current?.close()}>Back to your index <IconArrowRight size={16} /></button>
   </> : <form onSubmit={e => { e.preventDefault(); setPreview(true); }}>
    <label htmlFor={`handle-${placement}`}>Your page address</label>
    <div className="lab-publish-handle"><span>mypriors.com/</span><input id={`handle-${placement}`} value={handle} onChange={e => setHandle(e.target.value.toLowerCase())} placeholder="yourname" autoComplete="off" spellCheck={false} required pattern="[a-z0-9][a-z0-9-]{1,29}" minLength={2} maxLength={30} title="2 to 30 lowercase letters, numbers, or hyphens. Start with a letter or number." /></div>
    <button type="submit" className="lab-publish-primary">Preview published page <IconArrowRight size={16} /></button>
   </form>}
  </dialog>
 </>;
}
