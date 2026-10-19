import Link from "next/link";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { Wordmark } from "@/components/Wordmark";
import { loadSnapshot } from "@/data/load";
import { pageMeta } from "@/lib/site-meta";
import "./support.css";

export const metadata = pageMeta({ title: "Support Priors", description: "Priors is free and I pay for it myself. Here is what it costs and where your support goes.", path: "/support" });

const COFFEE = "https://buymeacoffee.com/adamholter";
const X_URL = "https://x.com/AdamHoltererer";

/** Monthly bills, in dollars, as of October 2026. Vercel is mostly rebuilds and is falling as builds get cheaper. */
const COSTS = [
  { name: "Hosting (Vercel)", usd: 70, note: "$70" },
  { name: "Sign-in (Clerk)", usd: 0, note: "$0" },
  { name: "Database (Convex)", usd: 0, note: "$0" },
  { name: "Analytics (PostHog)", usd: 0, note: "$0" },
  { name: "Domain", usd: 1, note: "$1" },
  { name: "Mix assistant", usd: 0.1, note: "$0.10" },
];

const GOALS = [
  { name: "Keep you signed in", usd: 25, why: "Free sign-in accounts log everyone out every 7 days. Clerk Pro keeps you signed in for months." },
  { name: "Cover hosting", usd: 50, why: "Hosting is the real bill, and it only grows with traffic. This covers most of it, so Priors never has to run ads or get a paywall." },
];

const XLogo = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;

export default async function SupportPage() {
  const snap = await loadSnapshot();
  const benchmarks = snap?.benchmarks?.filter((b) => !b.variantOf).length ?? 0;
  const models = snap?.models?.length ?? 0;
  const max = Math.max(...COSTS.map((c) => c.usd));
  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark /><Link href="/builder" className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><SettingsButton /></span></header>
      <div className="max-w-[1040px] mx-auto px-6 sm:px-8 py-12 sm:py-16 grid gap-16">
        <section className="sp-hero">
          <div className="grid gap-5">
            <div className="flex items-center gap-4">
              <a className="sp-x" href={X_URL} target="_blank" rel="noreferrer" aria-label="Adam Holter on X"><img src="/support/adam.jpg" alt="Adam Holter" width={72} height={72} /><XLogo /></a>
              <span className="cap">Adam Holter, who builds Priors</span>
            </div>
            <h1 className="text-[40px] sm:text-[52px] leading-[1.05] text-ink">Priors is free. I pay for it myself.</h1>
            <p className="text-[17px] leading-[1.65] text-ink-2">I build Priors on my own time so anyone can rank AI models by what they care about. There are no ads and no paywall, and I would like to keep it that way. If it has saved you time, a monthly coffee covers the bills that keep it running.</p>
            <p><a className="sp-cta" href={COFFEE} target="_blank" rel="noreferrer">Buy me a coffee</a></p>
          </div>
          <div className="sp-art" aria-hidden="true"><img className="sp-light" src="/intro/podium.png" alt="" width={1200} height={630} /><img className="sp-dark" src="/intro/podium-dark.png" alt="" width={1200} height={630} /></div>
        </section>

        <section className="grid gap-6">
          <h2 className="text-[28px] text-ink">What it is today</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div className="sp-stat"><b>{benchmarks}</b><span className="cap">benchmarks, scraped every 15 minutes</span></div>
            <div className="sp-stat"><b>{models}</b><span className="cap">models, matched by reasoning effort</span></div>
            <div className="sp-stat"><b>$0</b><span className="cap">to use, with no account needed</span></div>
          </div>
        </section>

        <section className="grid gap-6">
          <div className="grid gap-1"><h2 className="text-[28px] text-ink">Where the money goes</h2><p className="text-ink-2">Every monthly bill, in full.</p></div>
          <div className="grid gap-3">
            {COSTS.map((c) => <div key={c.name} className="sp-row"><span className="text-ink-2">{c.name}</span><div className="sp-track"><div className="sp-fill" style={{ width: `${Math.max(c.usd / max * 100, c.usd ? 1.5 : 0)}%` }} /></div><span className="sp-num">{c.note}</span></div>)}
          </div>
          <p className="cap">Most of the hosting bill is rebuilding the site. Data updates no longer trigger a rebuild, so it is already coming down.</p>
        </section>

        <section className="grid gap-6">
          <h2 className="text-[28px] text-ink">Two things your support would fix</h2>
          <div className="grid sm:grid-cols-2 gap-5">
            {GOALS.map((g) => (
              <div key={g.name} className="sp-goal">
                <div className="flex items-baseline justify-between gap-3"><h3 className="text-[19px] text-ink">{g.name}</h3><span className="sp-num">${g.usd} per month</span></div>
                <div className="sp-track"><div className="sp-fill is-goal" style={{ width: "0%" }} /></div>
                <p className="text-ink-2 text-[14.5px] leading-[1.6]">{g.why}</p>
                <p className="cap">Not funded yet. Mention it in your note and it goes here.</p>
              </div>
            ))}
          </div>
          <p><a className="sp-cta" href={COFFEE} target="_blank" rel="noreferrer">Buy me a coffee</a></p>
        </section>

        <section className="flex flex-wrap items-center gap-5 border-t border-hair pt-8">
          <p className="text-ink-2 max-w-[520px]">Not a good time? Telling a friend who ranks models, or sharing your index, helps just as much.</p>
          <a className="cap hover:text-ink" href="https://github.com/adamholter/priors" target="_blank" rel="noreferrer">Source on GitHub</a>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
