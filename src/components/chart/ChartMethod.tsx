"use client";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useLightDismiss } from "@/lib/useLightDismiss";

/** A small info icon beside a chart's title: how the chart is worked out, there when wanted and out of the way otherwise. */
export function ChartMethod({ name, children, href }: { name: string; children: React.ReactNode; href?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  useLightDismiss(root, dismiss);
  return <span ref={root} className="chart-method">
    <button type="button" className="hit" aria-label={`How ${name} is worked out`} aria-expanded={open} title="Methodology" onClick={() => setOpen(!open)}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.4" /><path d="M8 7.2v4" strokeLinecap="round" /><circle cx="8" cy="4.9" r=".55" fill="currentColor" stroke="none" /></svg>
    </button>
    {open && <span className="chart-method-pop" role="status">{children}{href && <Link href={href as "/"} className="chart-method-link">Full methodology</Link>}</span>}
  </span>;
}
