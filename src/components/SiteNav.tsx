import Link from "next/link";

/** Site-level links beside the wordmark: published pages, and the ranking onboarding (always at /rank). */
export function SiteNav({ current }: { current?: "explore" | "rank" }) {
  const item = (href: "/explore" | "/rank", label: string, id: "explore" | "rank", title: string) =>
    <Link href={href} title={title} aria-current={current === id ? "page" : undefined} className={`text-[13px] whitespace-nowrap hover:text-ink ${current === id ? "text-ink" : "text-ink-2"}`}>{label}</Link>;
  return <nav aria-label="Site" className="flex items-center gap-4">
    {item("/explore", "Explore", "explore", "See rankings people have published")}
    {item("/rank", "Rank models", "rank", "Find your priors by ranking models")}
  </nav>;
}
