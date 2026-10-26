import Link from "next/link";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { Wordmark } from "@/components/Wordmark";
import { loadSnapshot } from "@/data/load";
import { pageMeta } from "@/lib/site-meta";
import { Pledge } from "./Pledge";
import { ShareButton } from "./ShareButton";
import "./support.css";

export const metadata = pageMeta({ title: "Support Priors", description: "Priors is free and I pay for it myself. Here is what it costs and where your support goes.", path: "/support" });

const COFFEE = "https://buymeacoffee.com/adamholter";
const X_URL = "https://x.com/AdamHoltererer";

/** Monthly bills, in dollars, as of October 2026. Vercel is mostly rebuilds, and it grows with traffic. */
const HOSTING = 70;
const SMALL = 1.1;
const BILL = Math.round(HOSTING + SMALL);
const CLERK_PRO = 25;
const COSTS = [
  { name: "Hosting (Vercel)", usd: HOSTING, note: "$70", detail: "Servers and the work of rebuilding the site" },
  { name: "Domain and AI assistant", usd: SMALL, note: "$1", detail: "mypriors.com plus about ten cents of AI" },
  { name: "Sign-in, database, analytics", usd: 0, note: "Free", detail: "Clerk, Convex and PostHog, on free plans for now" },
];

const XLogo = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;

export default async function SupportPage() {
  const snap = await loadSnapshot();
  const benchmarks = snap?.benchmarks?.filter((b) => !b.variantOf).length ?? 0;
  const models = snap?.models?.length ?? 0;
  return (
    <main className="min-h-screen">
      <header className="flex items-center gap-6 px-8 h-14 border-b hairline"><Wordmark /><Link href="/builder" className="text-grey text-[13px] hover:text-ink">Builder</Link><span className="ml-auto"><SettingsButton /></span></header>
      <div className="max-w-[1040px] mx-auto px-6 sm:px-8 py-12 sm:py-16 grid gap-16">
        <section className="sp-hero">
          <div className="grid gap-5">
            <div className="flex items-center gap-4">
              <a className="sp-x" href={X_URL} target="_blank" rel="noreferrer" aria-label="Adam Holter on X"><img src="/support/adam.jpg" alt="Adam Holter" width={72} height={72} /><XLogo /></a>
              <span className="text-[15px] text-ink-2">Adam Holter, who builds Priors</span>
            </div>
            <h1 className="text-[40px] sm:text-[52px] leading-[1.05] text-ink">Priors costs ${BILL} a month. I pay it myself.</h1>
            <p className="text-[17px] leading-[1.65] text-ink-2">You have compared {models} models on {benchmarks} benchmarks without paying anything, and there are no ads. I want to keep it that way. If Priors is useful to you, a few dollars a month keeps it running.</p>
          </div>
          <Pledge />
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[28px] text-ink">This month&rsquo;s bill</h2><span className="sp-num">${BILL} a month</span></div>
          <div className="sp-track sp-track-lg"><div className="sp-fill" style={{ width: "100%" }} /></div>
          <div className="flex flex-wrap justify-between gap-2 text-[14px] text-ink-2"><span>Paid by me: ${BILL}</span><span>Paid by supporters: $0</span></div>
        </section>

<section className="grid gap-6">
          <div className="grid gap-1"><h2 className="text-[28px] text-ink">Where the money goes</h2><p className="text-ink-2">Every line, in full.</p></div>
          <div className="grid gap-4">
            {COSTS.map((c) => <div key={c.name} className="grid gap-1"><div className="sp-row"><span className="text-ink">{c.name}</span><div className="sp-track"><div className="sp-fill" style={{ width: `${Math.max(c.usd / HOSTING * 100, c.usd ? 1.5 : 0)}%` }} /></div><span className="sp-num">{c.note}</span></div><span className="text-[13.5px] text-ink-2">{c.detail}</span></div>)}
          </div>
          <p className="text-[14px] text-ink-2">Hosting grows with traffic, so the bill rises as more people use Priors.</p>
        </section>

<section className="grid gap-6">
          <div className="grid gap-1"><h2 className="text-[28px] text-ink">The goal: ${BILL + CLERK_PRO} a month</h2><p className="text-ink-2">Today&rsquo;s ${BILL}, plus ${CLERK_PRO} to stop signing everyone out.</p></div>
          <div className="sp-goal">
            <h3 className="text-[19px] text-ink">Keep you signed in</h3>
            <p className="text-ink-2 text-[15px] leading-[1.6]">Today, free sign-in accounts log everyone out every 7 days. Clerk Pro costs ${CLERK_PRO} a month and keeps you signed in for months. It is the first thing new support pays for.</p>
          </div>
        </section>

        <section className="flex flex-wrap items-center gap-5 border-t border-hair pt-8">
          <p className="text-ink-2 max-w-[520px]">Can&rsquo;t give right now? Sending Priors to someone who ranks models also helps.</p>
          <span className="ml-auto flex items-center gap-4"><ShareButton /><a className="text-[14px] text-ink-2 hover:text-ink" href="https://github.com/adamholter/priors" target="_blank" rel="noreferrer">Source on GitHub</a></span>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
