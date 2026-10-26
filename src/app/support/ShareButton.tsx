"use client";
import { useState } from "react";

/** Copies the site link, or opens the phone share sheet when there is one. */
export function ShareButton() {
  const [done, setDone] = useState(false);
  const share = async () => {
    const url = "https://mypriors.com";
    if (navigator.share) { try { await navigator.share({ title: "Priors", url }); return; } catch { /* dismissed: fall through to copy */ } }
    await navigator.clipboard?.writeText(url);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };
  return <button type="button" className="btn-quiet" onClick={share}>{done ? "Link copied" : "Share Priors"}</button>;
}
