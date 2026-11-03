"use client";
import Link from "next/link";
import { useEffect } from "react";
import { reportError } from "@/lib/analytics";

/** A page that crashed: say so plainly, offer a retry, and report it, because otherwise nobody hears about it. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { reportError(error, "page"); }, [error]);
  return <main className="min-h-dvh grid place-items-center px-6 text-center">
    <div className="grid gap-3 max-w-[44ch] justify-items-center">
      <h1 className="text-[28px]">This page hit an error</h1>
      <p className="text-[14px] text-ink-2">It has been reported. Try again, or go back to the builder.</p>
      <div className="flex gap-3"><button type="button" className="btn" onClick={() => retry()}>Try again</button><Link href="/builder" className="btn-quiet">Open the builder</Link></div>
    </div>
  </main>;
}
