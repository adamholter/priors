"use client";
import { useEffect, useState } from "react";
import { anchorOf } from "@/lib/metrics";

export { anchorOf };

/** True once when the page loads (or the hash changes) pointing at `id`. */
export function useHashTarget(id: string | undefined, onHit?: () => void) {
  useEffect(() => {
    if (!id) return;
    const check = () => {
      const url = new URL(window.location.href), hash = decodeURIComponent(url.hash.slice(1));
      if (hash ? hash !== id : url.searchParams.get("c") !== id) return;
      // Crawlers never see the #fragment; mirror it into ?c= so a copied address-bar link previews this chart.
      if (url.searchParams.get("c") !== id || !hash) { url.searchParams.set("c", id); url.hash = id; window.history.replaceState(null, "", url.toString()); }
      onHit?.();
      // Charts render after hydration and shift layout; scroll once they have settled.
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 450);
    };
    check();
    addEventListener("hashchange", check);
    return () => removeEventListener("hashchange", check);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}

/** Copies a link to this chart (current URL, which carries the index, plus #anchor). */
export function ChartLink({ id, name }: { id: string; name: string }) {
  const [copied, setCopied] = useState(false);
  useHashTarget(id);
  const copy = async () => {
    const url = new URL(window.location.href); url.searchParams.set("c", id); url.hash = id;
    window.history.replaceState(null, "", url.toString());
    try { await navigator.clipboard.writeText(url.toString()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the address bar still has the link */ }
  };
  return <button type="button" onClick={copy} className="relative grid place-items-center w-7 h-7 rounded-sm text-grey hover:text-ink focus-visible:outline-indigo" aria-label={`Copy link to ${name}`} title={copied ? "Link copied" : `Copy link to ${name}`}>
    {copied ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" /></svg>}
    <span role="status" className="sr-only">{copied ? "Link copied" : ""}</span>
  </button>;
}


