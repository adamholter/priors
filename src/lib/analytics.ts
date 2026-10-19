import posthog from "posthog-js";

/** Named product events. Autocapture already records clicks and pageviews; these add meaning. */
export type AnalyticsEvent =
  | "onboarding_completed" | "index_changed" | "profile_claimed" | "assistant_asked" | "assistant_saved"
  | "chart_exported" | "share_card_opened" | "share_card_shared"
  | "onboarding_started" | "onboarding_bracket_done" | "onboarding_compare_more" | "onboarding_skipped" | "onboarding_fit_started" | "publish_clicked"
  | "share_menu_opened" | "remix_clicked" | "explore_x_clicked"
  | "support_clicked" | "compare_opened" | "compare_link_copied" | "compare_changed";

/** No-op until PostHog is initialized (no key, localhost, or server). */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (typeof window === "undefined" || window.location.pathname.startsWith("/lab/") || !posthog.__loaded) return;
  posthog.capture(event, props);
}
