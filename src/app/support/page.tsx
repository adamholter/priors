import Link from "next/link";
import { SettingsButton } from "@/components/SiteSettings";
import { SiteFooter } from "@/components/SiteFooter";
import { Wordmark } from "@/components/Wordmark";
import { loadSnapshot } from "@/data/load";
import { pageMeta } from "@/lib/site-meta";
import { Pledge } from "./Pledge";
import { ShareButton } from "./ShareButton";
import "./support.css";

export const metadata = pageMeta({ title: "Support Priors", description: "Priors is free, and supporters now cover the whole bill. Here is what it costs and where your support goes.", path: "/support" });

const COFFEE = "https://buymeacoffee.com/adamholter";
const X_URL = "https://x.com/AdamHoltererer";

/** Monthly bills, in dollars, as of November 2026. Vercel is mostly rebuilds, and it grows with traffic. */
const HOSTING = 70;
const SMALL = 1.1;
const CLERK_PRO = 25;
const BILL = Math.round(HOSTING + SMALL + CLERK_PRO);
const COSTS = [
  { name: "Hosting (Vercel)", usd: HOSTING, note: "$70", detail: "Servers and the work of rebuilding the site" },
  { name: "Sign-in (Clerk Pro)", usd: CLERK_PRO, note: "$25", detail: "Keeps you signed in for months instead of 7 days. Funded by supporters" },
  { name: "Domain and AI assistant", usd: SMALL, note: "$1", detail: "mypriors.com plus about ten cents of AI" },
  { name: "Database, analytics", usd: 0, note: "Free", detail: "Convex and PostHog, on free plans" },
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
            <h1 className="text-[40px] sm:text-[52px] leading-[1.05] text-ink">Priors costs ${BILL} a month. Supporters cover all of it.</h1>
            <p className="text-[17px] leading-[1.65] text-ink-2">You have compared {models} models on {benchmarks} benchmarks without paying anything, and there are no ads. That works because people who find Priors useful chip in. Thank you to everyone who does.</p>
          </div>
          <Pledge />
        </section>

        <section className="grid gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-[28px] text-ink">This month&rsquo;s bill</h2><span className="sp-num">${BILL} a month</span></div>
          <div className="sp-track sp-track-lg"><div className="sp-fill is-goal" style={{ width: "100%" }} /></div>
          <div className="flex flex-wrap justify-between gap-2 text-[14px] text-ink-2"><span>Paid by supporters: ${BILL}</span><span>Paid by me: $0</span></div>
        </section>

<section className="grid gap-6">
          <div className="grid gap-1"><h2 className="text-[28px] text-ink">Where the money goes</h2><p className="text-ink-2">Every line, in full.</p></div>
          <div className="grid gap-4">
            {COSTS.map((c) => <div key={c.name} className="grid gap-1"><div className="sp-row"><span className="text-ink">{c.name}</span><div className="sp-track"><div className="sp-fill" style={{ width: `${Math.max(c.usd / HOSTING * 100, c.usd ? 1.5 : 0)}%` }} /></div><span className="sp-num">{c.note}</span></div><span className="text-[13.5px] text-ink-2">{c.detail}</span></div>)}
          </div>
          <p className="text-[14px] text-ink-2">Hosting grows with traffic, so the bill rises as more people use Priors.</p>
        </section>

<section className="grid gap-6">
          <div className="grid gap-1"><h2 className="text-[28px] text-ink">What extra support does</h2><p className="text-ink-2">The bill is covered, and the first goal is funded.</p></div>
          <div className="sp-goal">
            <h3 className="text-[19px] text-ink">Keeping you signed in: funded</h3>
            <p className="text-ink-2 text-[15px] leading-[1.6]">Supporters fund Clerk Pro, so sign-ins last months instead of logging everyone out every 7 days. Support beyond the bill keeps Priors covered as traffic grows.</p>
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
