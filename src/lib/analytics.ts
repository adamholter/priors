import type { PostHog } from "posthog-js";

/** Named product events. Autocapture already records clicks and pageviews; these add meaning. */
export type AnalyticsEvent =
  | "onboarding_completed" | "index_changed" | "profile_claimed" | "assistant_asked" | "assistant_saved"
  | "chart_exported" | "custom_theme_added" | "share_card_opened" | "share_card_shared"
  | "onboarding_started" | "onboarding_bracket_done" | "onboarding_compare_more" | "onboarding_skipped" | "onboarding_fit_started" | "publish_clicked"
  | "share_menu_opened" | "remix_clicked" | "explore_x_clicked"
  | "dom_guarded" | "support_clicked" | "site_search_opened" | "compare_opened" | "compare_link_copied" | "compare_changed" | "request_sent" | "version_notice" | "benchmark_star";

const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();

/**
 * Exceptions that are not Priors bugs, kept out of error tracking so its inbox shows real ones: cross-origin "Script error."
 * (extensions, other sites' scripts), the benign ResizeObserver loop note, wallet and extension messaging, Outlook's link
 * scanner, and view transitions the browser cancels when a newer navigation starts (Nov 2-16, 2026: about 1,400 of 1,500).
 */
export const EXCEPTION_NOISE = /^Script error\.?$|ResizeObserver loop|window\.ethereum|runtime\.sendMessage|Object Not Found Matching Id|provider is disconnected|ViewTransition|view transition|Transition was (skipped|aborted)/i;
export function isNoiseException(props: Record<string, unknown> | undefined): boolean {
  const values = (props?.$exception_values as unknown[] | undefined) ?? (props?.$exception_list as { value?: unknown }[] | undefined)?.map((e) => e?.value);
  return !!values?.length && values.every((v) => typeof v === "string" && EXCEPTION_NOISE.test(v));
}
let loading: Promise<PostHog> | null = null;

/** PostHog is over 300 KB and nothing on screen depends on it, so it downloads after the page has settled, or at the first event. Off without a key, and never on localhost. */
export function startAnalytics(): Promise<PostHog> | null {
  if (typeof window === "undefined" || !key || /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return null;
  return loading ??= import("posthog-js").then(({ default: posthog }) => {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: "https://us.posthog.com",
      defaults: "2026-08-30",
      // Anonymous visitors are counted without person profiles; signed-in users get one (see AnalyticsIdentity).
      person_profiles: "identified_only",
      // Inputs are masked; elements marked .ph-no-capture (e.g. the one-time agent token) are never recorded.
      session_recording: { maskAllInputs: true },
      // Uncaught errors reach error tracking; error.tsx and global-error.tsx report the ones React catches.
      capture_exceptions: true,
      before_send: (event) => (event?.event === "$exception" && isNoiseException(event.properties) ? null : event),
    });
    // The page-translation guard (DOM_GUARD_SCRIPT) stepped in: count it, with the languages, once per page.
    let guarded = false;
    window.addEventListener("priors:dom-guard", () => {
      if (guarded) return; guarded = true;
      posthog.capture("dom_guarded", { page_lang: document.documentElement.lang, browser_lang: navigator.language, translated: /translated/.test(document.documentElement.className) });
    });
    return posthog;
  });
}

/** Runs once PostHog is up. The returned function cancels it, for effects whose values have moved on. */
export function whenAnalytics(run: (posthog: PostHog) => void): () => void {
  let live = true;
  startAnalytics()?.then((posthog) => { if (live) run(posthog); }).catch(() => { /* a blocked download only loses analytics */ });
  return () => { live = false; };
}

/** A crash an error boundary caught, so it still gets reported. */
export function reportError(error: Error & { digest?: string }, boundary: "page" | "root") {
  whenAnalytics((posthog) => posthog.captureException(error, { boundary, digest: error.digest }));
}

/** No-op with no key, on localhost, or on the server. */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  whenAnalytics((posthog) => posthog.capture(event, props));
}
