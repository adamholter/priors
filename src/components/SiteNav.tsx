"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { SITE_PLACES, type SiteId as Id } from "./site-places";
import { openSiteSearch } from "./SiteSearch";
import { IconSearch } from "@tabler/icons-react";
import { track } from "@/lib/analytics";

/**
 * Site-level links beside the wordmark: the data, the model and benchmark directories, published pages, and the ranking onboarding (always at /rank).
 * Each has an icon (from 1024px; narrower desktop headers have no room) and the page you are on is filled. `mobile` is the phone row under the header: five icons with short labels, which slides
 * away while you scroll down and comes back as soon as you scroll up, without going back to the top (`useHeadroom`).
 * Rank models is in an A/B test (src/lib/ab-rank.ts): its links carry `rank-in-header`, which the "corner" arm hides.
 */
export function SiteNav({ current, mobile = false }: { current?: Id; mobile?: boolean }) {
  if (mobile) return <PhoneNav current={current} />;
  return <nav aria-label="Site" className="flex items-center gap-0.5">
    {SITE_PLACES.map((p) => <Link key={p.id} href={p.href} title={p.title} aria-current={current === p.id ? "page" : undefined} onClick={p.id === "rank" ? () => track("rank_cta_clicked", { placement: "header" }) : undefined}
      className={`${p.id === "rank" ? "rank-in-header " : ""}inline-flex items-center gap-1.5 px-1.5 lg:px-2.5 py-1.5 rounded-md text-[13px] whitespace-nowrap no-underline ${current === p.id ? "text-ink bg-hair-2" : "text-ink-2 hover:text-ink hover:bg-hair-2/60"}`}>
      <p.icon size={16} stroke={1.6} aria-hidden="true" className="max-lg:hidden" />{p.label}</Link>)}
  </nav>;
}

type Mode = "flow" | "shown" | "hidden";
/**
 * Headroom: the element sits in the page until it scrolls out of view; past that, it is pinned to the top of the window while you scroll up
 * and slides away while you scroll down. A spacer keeps its place in the page so nothing jumps.
 */
function useHeadroom() {
  const spot = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null);
  const [mode, setMode] = useState<Mode>("flow"), [height, setHeight] = useState(0);
  useLayoutEffect(() => { if (bar.current) setHeight(bar.current.offsetHeight); }, []);
  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const el = spot.current;
      if (!el || !el.offsetParent) return; // hidden (wider than a phone)
      const y = window.scrollY, top = el.getBoundingClientRect().top + y, dy = y - lastY;
      lastY = y;
      if (y <= top) { setMode("flow"); return; }
      if (dy > 3) setMode((m) => (m === "flow" && y < top + el.offsetHeight ? m : "hidden"));
      else if (dy < -3) setMode("shown");
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return { spot, bar, mode, height };
}

function PhoneNav({ current }: { current?: Id }) {
  const { spot, bar, mode, height } = useHeadroom();
  const pinned = mode !== "flow";
  return <div ref={spot} className="sm:hidden" style={pinned && height ? { height } : undefined}>
    <nav ref={bar} aria-label="Site"
      className={`flex [&>*]:flex-1 ${pinned ? `fixed top-0 inset-x-0 z-40 px-4 bg-bone/95 backdrop-blur border-b hairline transition-transform duration-200 motion-reduce:transition-none ${mode === "hidden" ? "-translate-y-full" : "translate-y-0"}` : "-mx-1"}`}>
      {SITE_PLACES.map((p) => <Link key={p.id} href={p.href} aria-current={current === p.id ? "page" : undefined} onClick={p.id === "rank" ? () => track("rank_cta_clicked", { placement: "header_phone" }) : undefined}
        className={`${p.id === "rank" ? "rank-in-header " : ""}grid justify-items-center gap-0.5 py-1.5 text-[11px] no-underline ${current === p.id ? "text-ink" : "text-ink-2"}`}>
        <p.icon size={19} stroke={current === p.id ? 2 : 1.6} aria-hidden="true" />{p.short}</Link>)}
      <button type="button" onClick={openSiteSearch} className="grid justify-items-center gap-0.5 py-1.5 text-[11px] text-ink-2"><IconSearch size={19} stroke={1.6} aria-hidden="true" />Search</button>
    </nav>
  </div>;
}
