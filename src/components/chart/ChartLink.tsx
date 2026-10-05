"use client";
import { useEffect, useRef, useState, type RefObject } from "react";
import { anchorOf } from "@/lib/metrics";
import { chartLinkUrl } from "@/lib/highlight-link";
import { useHighlight } from "./highlight";
import { ChartLinkIcon } from "./ChartIcons";

export { anchorOf };

/** Chart-view params carried by deep links: `cv=bars|scatter` when it differs from the chart default, `cm=` for effort mode. */
export interface ChartLinkParams { cv?: "bars" | "scatter"; cm?: "best" | "all" }

/** Mirroring only sets — never deletes — so a linked panel's own init pass can still read cv/cm. */
function mirrorParams(url: URL, id: string, params?: ChartLinkParams) {
  url.searchParams.set("c", id);
  url.hash = id;
  if (params?.cv) url.searchParams.set("cv", params.cv);
  if (params?.cm) url.searchParams.set("cm", params.cm);
}

/** True once when the page loads (or the hash changes) pointing at `id`. */
export function useHashTarget(id: string | undefined, onHit?: () => void, params?: RefObject<ChartLinkParams | undefined>) {
  useEffect(() => {
    if (!id) return;
    const check = () => {
      const url = new URL(window.location.href), hash = decodeURIComponent(url.hash.slice(1));
      if (hash ? hash !== id : url.searchParams.get("c") !== id) return;
      // Crawlers never see the #fragment; mirror it into ?c= so a copied address-bar link previews this chart.
      if (url.searchParams.get("c") !== id || !hash || params) { mirrorParams(url, id, params?.current); window.history.replaceState(null, "", url.toString()); }
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
export function ChartLink({ id, name, params }: { id: string; name: string; params?: ChartLinkParams }) {
  const highlight = useHighlight();
  const [copied, setCopied] = useState(false);
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; });
  useHashTarget(id, undefined, params ? paramsRef : undefined);
  const copy = async () => {
    const url = chartLinkUrl(window.location.href, id, params, highlight ?? undefined);
    window.history.replaceState(null, "", url.toString());
    try { await navigator.clipboard.writeText(url.toString()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the address bar still has the link */ }
  };
  return <button type="button" onClick={copy} className="relative grid place-items-center w-7 h-7 rounded-sm text-grey hover:text-ink focus-visible:outline-indigo" aria-label={`Copy link to ${name}`} title={copied ? "Link copied" : `Copy link to ${name}`}>
    {copied ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
      : <ChartLinkIcon />}
    <span role="status" className="sr-only">{copied ? "Link copied" : ""}</span>
  </button>;
}
