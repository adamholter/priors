"use client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import dynamic from "next/dynamic";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useEffect, useMemo, type ReactNode } from "react";
import { ThemeProvider } from "@/components/Theme";
import { authEnabled, useAuth, useClerkDetection, useClerkWanted, useUser } from "@/lib/auth";
import { whenAnalytics } from "@/lib/analytics";

export { authEnabled };
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
export const convexEnabled = !!convexUrl;

const ClerkLayer = dynamic(() => import("@/components/auth/ClerkLayer"), { ssr: false });

export function Providers({ children }: { children: ReactNode }) {
  const convex = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);
  let inner: ReactNode = <NuqsAdapter>{children}</NuqsAdapter>;
  if (convex && authEnabled) inner = <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{inner}</ConvexProviderWithClerk>;
  else if (convex) inner = <ConvexProvider client={convex}>{inner}</ConvexProvider>;
  return <ThemeProvider>{authEnabled && <Auth />}{inner}</ThemeProvider>;
}

function Auth() {
  useClerkDetection();
  const wanted = useClerkWanted();
  return <><AnalyticsIdentity />{wanted && <ClerkLayer />}</>;
}

/** Ties analytics to the Clerk user id while signed in; resets on sign-out. Email is not sent. */
function AnalyticsIdentity() {
  const { isLoaded, user } = useUser();
  useEffect(() => {
    if (!isLoaded) return;
    return whenAnalytics((posthog) => {
      if (user) posthog.identify(user.id, { name: user.fullName ?? undefined, handle: localStorage.getItem("priors:handle") ?? undefined });
      else if (posthog.get_property("$user_state") === "identified") posthog.reset();
    });
  }, [isLoaded, user]);
  return null;
}
