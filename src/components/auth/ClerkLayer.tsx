"use client";
import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { GetToken, LoadedClerk } from "@clerk/shared/types";
import { useTheme } from "@/components/Theme";
import { ResumeSignIn } from "@/components/ResumeSignIn";
import { publishAuth, useSignInSlot } from "@/lib/auth";

const CLERK_LIGHT = { colorPrimary: "#2F4FB0", fontFamily: "var(--font-inter)", borderRadius: "4px" };
const CLERK_DARK = { ...CLERK_LIGHT, colorPrimary: "#3E5BC2", colorPrimaryForeground: "#FFFFFF", colorBackground: "#1C1C1A", colorForeground: "#EDECE6", colorMutedForeground: "#A9A8A0", colorMuted: "#242422", colorInput: "#141413", colorInputForeground: "#EDECE6", colorNeutral: "#EDECE6", colorDanger: "#F0907F", colorModalBackdrop: "rgba(0, 0, 0, .55)" };

/** Clerk itself: downloaded and mounted only when `@/lib/auth` says this browser needs it. It sits beside the app rather than around it, so it can arrive mid-visit without remounting the page. */
export default function ClerkLayer() {
  const { dark } = useTheme();
  return <ClerkProvider appearance={{ variables: dark ? CLERK_DARK : CLERK_LIGHT }}><Publish /><ResumeSignIn /><SignInForm /></ClerkProvider>;
}

function Publish() {
  const { isLoaded, isSignedIn, userId, sessionId, sessionClaims, orgId, orgRole, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  useEffect(() => {
    if (isLoaded) publishAuth({ isLoaded, isSignedIn, userId, sessionId, sessionClaims, orgId, orgRole, user, getToken: getToken as GetToken, clerk: clerk as LoadedClerk });
  }, [isLoaded, isSignedIn, userId, sessionId, sessionClaims, orgId, orgRole, user, getToken, clerk]);
  return null;
}

function SignInForm() {
  const slot = useSignInSlot();
  return slot && createPortal(<SignIn forceRedirectUrl={slot.forceRedirectUrl} signUpForceRedirectUrl={slot.signUpForceRedirectUrl} />, slot.node);
}
