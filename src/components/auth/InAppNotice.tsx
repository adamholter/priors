"use client";
import { useState } from "react";
import type { InAppBrowser } from "@/lib/in-app-browser";
import { openInBrowserHref } from "@/lib/in-app-browser";

/** Shown on the sign-in page inside an app's built-in browser, where Google sign-in cannot finish. */
export function InAppNotice({ browser }: { browser: InAppBrowser }) {
  const [copied, setCopied] = useState(false);
  const here = typeof window === "undefined" ? "https://mypriors.com/sign-in" : window.location.href;
  const where = browser.app ? `the ${browser.app} app` : "this app";
  const copy = async () => { try { await navigator.clipboard.writeText(here); setCopied(true); } catch { /* clipboard blocked */ } };
  return (
    <div role="note" className="max-w-[400px] w-full border border-hair rounded-[4px] p-4 grid gap-3 text-[14px]">
      <p className="text-ink"><b>Google sign-in doesn’t work inside {where}.</b></p>
      <p className="text-ink-2">Open Priors in your browser to continue with Google, or sign in with your email below.</p>
      <div className="flex flex-wrap gap-2">
        <a className="btn" href={openInBrowserHref(here, browser.os)}>Open in {browser.os === "ios" ? "Safari" : "browser"}</a>
        <button type="button" className="btn-quiet" onClick={copy}>{copied ? "Link copied" : "Copy link"}</button>
      </div>
    </div>
  );
}
