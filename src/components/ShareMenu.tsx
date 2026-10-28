"use client";
import { useEffect, useId, useRef, useState } from "react";
import { IconBrandX, IconCopy, IconDownload, IconLink, IconShare } from "@tabler/icons-react";
import { copyCardImage, shareCardToX, shareText } from "@/lib/share";
import { track } from "@/lib/analytics";
import "@/components/share-menu.css";
import { copyLink } from "@/lib/short-link";

export function ShareMenu({ imageUrl, link, top, label, note, from, onMessage }: { imageUrl: string; link: string; top: string[]; label?: string; /** A line about the ranking for the post text. */ note?: string; /** Where the menu sits, for analytics. */ from?: string; onMessage: (text: string) => void }) {
 const shared = (target: string) => track("share_card_shared", { target, from });
 const [open, setOpen] = useState(false);
 const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
 const id = useId();
 useEffect(() => {
  if (!open) return;
  menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
  document.addEventListener("pointerdown", outside);
  return () => document.removeEventListener("pointerdown", outside);
 }, [open]);
 const close = () => { setOpen(false); trigger.current?.focus(); };
 return <div ref={root} className="share-menu">
  <button ref={trigger} type="button" className={`share-trigger ${label ? "with-label" : ""}`} aria-label="Share your index" aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => { if (!open) track("share_menu_opened", { from }); setOpen(v => !v); }}><IconShare size={18} stroke={1.6} />{label}</button>
  {open && <div ref={menu} id={id} role="menu" aria-label="Share options" className="share-options" onKeyDown={e => {
   if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
   if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
    e.preventDefault(); const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")], i = items.indexOf(document.activeElement as HTMLElement);
    items[e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
   }
   if (e.key === "Tab") setOpen(false);
  }}>
   <button role="menuitem" type="button" onClick={async () => { close(); shared("x"); onMessage(await shareCardToX({ imageUrl, text: shareText(top, undefined, note), url: link, fileName: "my-priors.png" })); }}><IconBrandX size={16} />Share on X</button>
   <button role="menuitem" type="button" onClick={async () => { close(); shared("copy-image"); onMessage(await copyCardImage(imageUrl)); }}><IconCopy size={16} />Copy the image</button>
   <a role="menuitem" href={imageUrl} download="my-priors.png" onClick={() => { shared("download"); close(); }}><IconDownload size={16} />Download the image</a>
   <button role="menuitem" type="button" onClick={async () => { close(); shared("link"); try { await copyLink(link); onMessage("Link copied."); } catch { onMessage("Could not copy the link. Try again."); } }}><IconLink size={16} />Share a link</button>
  </div>}
 </div>;
}
