import Link from "next/link";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { Wordmark } from "@/components/Wordmark";
import { pageMeta } from "@/lib/site-meta";

export const metadata = pageMeta({ title: "Support Priors", description: "Priors is free and paid for out of pocket. Here is what it costs and how to help.", path: "/support" });

const COFFEE = "https://buymeacoffee.com/adamholter";

const GOALS = [
  { name: "Stay signed in", amount: "$25 per month", why: "Free sign-in accounts log everyone out every 7 days. Clerk Pro keeps people signed in for months.", href: COFFEE },
  { name: "Hosting", amount: "$50 per month", why: "The site costs about $70 a month to run, and most of that is rebuilding it. Fresher data and cheaper builds are bringing it down.", href: COFFEE },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark /><Link href="/builder" className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><SettingsButton /></span></header>
      <article className="max-w-[720px] mx-auto px-8 py-12 grid gap-8 text-[15px] leading-[1.7] text-ink-2">
        <div className="grid gap-3">
          <h1 className="text-[36px] text-ink">Support Priors</h1>
          <p>Priors is free, and I pay for it myself. If it is useful to you, here are ways to help.</p>
          <p className="flex flex-wrap gap-3">
            <a className="btn" href={COFFEE} target="_blank" rel="noreferrer">Buy me a coffee</a>
            <a className="btn-quiet" href="https://x.com/AdamHoltererer" target="_blank" rel="noreferrer">Follow on X</a>
            <a className="btn-quiet" href="https://github.com/adamholter/priors" target="_blank" rel="noreferrer">GitHub</a>
          </p>
        </div>
        <section className="grid gap-4">
          <h2 className="text-[22px] text-ink">What your support pays for</h2>
          {GOALS.map((g) => (
            <div key={g.name} className="grid gap-1 border-t border-hair pt-4">
              <div className="flex items-baseline gap-3"><h3 className="text-[17px] text-ink">{g.name}</h3><span className="cap">{g.amount}, open</span></div>
              <p>{g.why}</p>
              <p><a className="text-indigo" href={g.href} target="_blank" rel="noreferrer">Help fund this</a></p>
            </div>
          ))}
        </section>
        <p className="cap">Mention the goal in your note and it goes there. Monthly support can be cancelled any time.</p>
      </article>
      <SiteFooter />
    </main>
  );
}
