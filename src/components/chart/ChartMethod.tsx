"use client";
import Link from "next/link";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useLightDismiss } from "@/lib/useLightDismiss";

/** A small info icon beside a chart's title: how the chart is worked out, there when wanted and out of the way otherwise. */
export function ChartMethod({ name, children, href }: { name: string; children: React.ReactNode; href?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  useLightDismiss(root, dismiss);
  // The icon sits wherever the title ends, so on a phone the popover can run off the right edge: shift it left until it fits.
  const pop = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = pop.current;
    if (!open || !el) return;
    const fit = () => {
      el.style.left = "0px";
      const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, over = r.right - (vw - 12);
      if (over > 0) el.style.left = `${-Math.min(over, r.left - 12)}px`;
    };
    fit();
    // Opened low on a phone, the popover runs under the browser's bottom bar: scroll it up into view (never past the page top bar).
    const r = el.getBoundingClientRect(), over = r.bottom - (window.innerHeight - 96), room = r.top - 72;
    if (over > 0 && room > 0) window.scrollBy({ top: Math.min(over, room), behavior: "instant" });
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);
  return <span ref={root} className="chart-method">
    <button type="button" className="hit" aria-label={`How ${name} is worked out`} aria-expanded={open} title="Methodology" onClick={() => setOpen(!open)}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.4" /><path d="M8 7.2v4" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".55" fill="currentColor" stroke="none" /></svg>
    </button>
    {open && <span ref={pop} className="chart-method-pop" role="status">{children}{href && <Link href={href as "/"} className="chart-method-link">Full methodology</Link>}</span>}
  </span>;
}
