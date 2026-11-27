"use client";
import Link from "next/link";
import { IconHeart } from "@tabler/icons-react";
import { track } from "@/lib/analytics";

/** The way to /support from every header and footer: a heart that stays visible on phones, with the word beside it from 640px (or `label` at every width). */
export function SupportLink({ from, className = "support-link", label }: { from: string; className?: string; /** Shown at every width (the footer's list), instead of "Support" from 640px. */ label?: string }) {
  return <Link prefetch={false} href="/support" className={className} aria-label="Support Priors" onClick={() => track("support_clicked", { from })}><IconHeart size={label ? 15 : 17} stroke={1.75} aria-hidden="true" />{label ? <span>{label}</span> : <span className="support-label">Support</span>}</Link>;
}
