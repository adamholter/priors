import posthog from "posthog-js";

// Product analytics. Off unless NEXT_PUBLIC_POSTHOG_KEY is set, and never on localhost.
// Events go through the same-origin /ingest proxy (next.config rewrites) so blockers don't drop them.
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
if (key && !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) {
  posthog.init(key, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    // Anonymous visitors are counted without person profiles; signed-in users get one (see AnalyticsIdentity).
    person_profiles: "identified_only",
    session_recording: { maskAllInputs: true },
  });
}
