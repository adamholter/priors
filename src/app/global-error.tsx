"use client";
import { useEffect } from "react";
import { reportError } from "@/lib/analytics";

/** The root layout itself crashed, so nothing of the site's is available here, its stylesheet included. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { reportError(error, "root"); }, [error]);
  return <html lang="en"><body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "20vh 24px" }}>
    <h1 style={{ fontWeight: 500 }}>Priors hit an error</h1>
    <p>It has been reported.</p>
    <button type="button" onClick={() => retry()}>Try again</button>
  </body></html>;
}
