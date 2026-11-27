"use client";
import Link from "next/link";
import { IconArrowsSort } from "@tabler/icons-react";
import { track } from "@/lib/analytics";

/**
 * The "corner" arm of the Rank models A/B test (src/lib/ab-rank.ts): a floating button in the bottom-right corner, on every page that has
 * the site header. Hidden by CSS for the "header" arm, beside the assistant's button where that is on the page, and while its panel is open.
 */
export function RankFloat() {
  return <Link href="/rank" prefetch={false} className="rank-float" aria-label="Rank models" onClick={() => track("rank_cta_clicked", { placement: "corner" })}>
    <IconArrowsSort size={18} stroke={1.75} aria-hidden="true" /><span>Rank models</span>
  </Link>;
}
