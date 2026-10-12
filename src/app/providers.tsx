"use client";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useEffect, useMemo, type ReactNode } from "react";
import { ThemeProvider, useTheme } from "@/components/Theme";
import { ResumeSignIn } from "@/components/ResumeSignIn";

export const authEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
export const convexEnabled = !!convexUrl;

export function Providers({ children }: { children: ReactNode }) {
  const convex = useMemo(() => (convexUrl ? new ConvexReactClient(convexUrl) : null), []);
  let inner: ReactNode = <NuqsAdapter>{children}</NuqsAdapter>;
  if (convex && authEnabled) inner = <ConvexProviderWithClerk client={convex} useAuth={useAuth}>{inner}</ConvexProviderWithClerk>;
  else if (convex) inner = <ConvexProvider client={convex}>{inner}</ConvexProvider>;
  return <ThemeProvider>{authEnabled ? <ThemedClerk>{inner}</ThemedClerk> : inner}</ThemeProvider>;
}

const CLERK_LIGHT = { colorPrimary: "#2F4FB0", fontFamily: "var(--font-inter)", borderRadius: "4px" };
const CLERK_DARK = { ...CLERK_LIGHT, colorPrimary: "#3E5BC2", colorPrimaryForeground: "#FFFFFF", colorBackground: "#1C1C1A", colorForeground: "#EDECE6", colorMutedForeground: "#A9A8A0", colorMuted: "#242422", colorInput: "#141413", colorInputForeground: "#EDECE6", colorNeutral: "#EDECE6", colorDanger: "#F0907F", colorModalBackdrop: "rgba(0, 0, 0, .55)" };
function ThemedClerk({ children }: { children: ReactNode }) {
  const { dark } = useTheme();
  return <ClerkProvider appearance={{ variables: dark ? CLERK_DARK : CLERK_LIGHT }}><AnalyticsIdentity /><ResumeSignIn />{children}</ClerkProvider>;
}

/** Ties analytics to the Clerk user id while signed in; resets on sign-out. Email is not sent. */
function AnalyticsIdentity() {
  const { isLoaded, user } = useUser();
  useEffect(() => {
    if (!isLoaded || !posthog.__loaded) return;
    if (user) posthog.identify(user.id, { name: user.fullName ?? undefined, handle: localStorage.getItem("priors:handle") ?? undefined });
    else if (posthog.get_property("$user_state") === "identified") posthog.reset();
  }, [isLoaded, user]);
  return null;
}
