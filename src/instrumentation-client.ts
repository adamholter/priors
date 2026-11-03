import { startAnalytics } from "@/lib/analytics";

// Product analytics start once the page has loaded and the browser is idle. Events go through the same-origin /ingest proxy (next.config rewrites) so blockers don't drop them.
const start = () => { if ("requestIdleCallback" in window) requestIdleCallback(() => void startAnalytics(), { timeout: 2000 }); else setTimeout(() => void startAnalytics(), 1000); };
if (document.readyState === "complete") start();
else window.addEventListener("load", start, { once: true });
