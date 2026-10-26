"use client";
import { useState } from "react";

const COFFEE = "https://buymeacoffee.com/adamholter";
/** One link per monthly amount. All three go to the Buy Me a Coffee page until each tier has its own link. */
const TIERS = [{ usd: 5, href: COFFEE }, { usd: 25, href: COFFEE }, { usd: 50, href: COFFEE }];

/** The ask: monthly amounts with the smallest preselected, and a button that names the amount. */
export function Pledge() {
  const [usd, setUsd] = useState(5);
  const tier = TIERS.find((t) => t.usd === usd) ?? TIERS[0];
  return (
    <div className="sp-pledge">
      <h2 className="text-[19px] text-ink">Cover the bill</h2>
      <div className="sp-amounts" role="radiogroup" aria-label="Monthly amount">
        {TIERS.map((t) => <button key={t.usd} type="button" role="radio" aria-checked={t.usd === usd} className="sp-amount" onClick={() => setUsd(t.usd)}>${t.usd}<span>a month</span></button>)}
      </div>
      <a className="sp-cta sp-cta-wide" href={tier.href} target="_blank" rel="noreferrer">Support Priors for ${usd} a month</a>
      <p className="text-[13.5px] leading-[1.55] text-ink-2">Cancel any time. 15 people at $5 a month covers all of it.</p>
    </div>
  );
}
