"use client";
import Link from "next/link";
import { IconHeart } from "@tabler/icons-react";
import { track } from "@/lib/analytics";

/** The way to /support from every header and footer: a heart that stays visible on phones, with the word beside it from 640px. */
export function SupportLink({ from, className = "support-link" }: { from: string; className?: string }) {
  return <Link href="/support" className={className} aria-label="Support Priors" onClick={() => track("support_clicked", { from })}><IconHeart size={17} stroke={1.75} aria-hidden="true" /><span className="support-label">Support</span></Link>;
}
