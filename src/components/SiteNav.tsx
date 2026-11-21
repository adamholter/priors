import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Site-level links beside the wordmark: the data, the benchmark directory, published pages, and the ranking onboarding (always at /rank).
 * On phones the current page's own link is left out and "Rank models" reads "Rank", so the row beside Share and Sign in stays one line at 360px.
 */
export function SiteNav({ current }: { current?: "builder" | "benchmarks" | "explore" | "rank" }) {
  const item = (href: "/builder" | "/benchmarks" | "/explore" | "/rank", label: ReactNode, id: "builder" | "benchmarks" | "explore" | "rank", title: string) =>
    <Link href={href} title={title} aria-current={current === id ? "page" : undefined} className={`hit text-[13px] whitespace-nowrap hover:text-ink ${current === id ? "text-ink max-sm:hidden" : "text-ink-2"}`}>{label}</Link>;
  return <nav aria-label="Site" className="flex items-center gap-3 sm:gap-4">
    {item("/builder", "Data", "builder", "Rankings and charts for every model")}
    {item("/benchmarks", "Benchmarks", "benchmarks", "Every benchmark Priors reads, with its quality and leaderboard")}
    {item("/explore", "Explore", "explore", "See rankings people have published")}
    {item("/rank", <><span className="sm:hidden">Rank</span><span className="max-sm:hidden">Rank models</span></>, "rank", "Find your priors by ranking models")}
  </nav>;
}
