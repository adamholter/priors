"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { markLeaving, startsNavigation } from "./nav-progress";

/** A page can take a moment to arrive after its link is clicked: this answers the click at once. */
export function NavProgress() {
  const pathname = usePathname();
  const [on, setOn] = useState(false);
  const [from, setFrom] = useState(pathname);
  if (pathname !== from) { setFrom(pathname); setOn(false); }
  useEffect(() => markLeaving(false), [pathname]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && startsNavigation({ href: link.href, target: link.target, download: link.hasAttribute("download") }, e, location.href)) { markLeaving(true); setOn(true); }
    };
    // Capture phase: next/link cancels the click's default action on its way up, so by the bubble phase every link looks handled.
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  useEffect(() => {
    if (!on) return;
    // A link that never arrives (offline, a redirect back here) must not leave the bar running.
    const off = setTimeout(() => { markLeaving(false); setOn(false); }, 12_000);
    return () => clearTimeout(off);
  }, [on]);
  return on ? <div className="nav-progress" aria-hidden="true" /> : null;
}
