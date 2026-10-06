import posthog from "posthog-js";

/** Named product events. Autocapture already records clicks and pageviews; these add meaning. */
export type AnalyticsEvent =
  | "onboarding_completed" | "index_changed" | "profile_claimed" | "assistant_asked"
  | "chart_exported" | "share_card_opened" | "share_card_shared";

/** No-op until PostHog is initialized (no key, localhost, or server). */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || !posthog.__loaded) return;
  posthog.capture(event, props);
}
