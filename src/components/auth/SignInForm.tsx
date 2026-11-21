"use client";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { requireClerk, setSignInSlot } from "@/lib/auth";
import { inAppBrowser } from "@/lib/in-app-browser";
import { InAppNotice } from "./InAppNotice";

const noSubscribe = () => () => {};

/** Where Clerk's sign-in form appears, once its code arrives. Inside an app's built-in browser it says how to get out, and leaves Google off the form. */
export function SignInForm({ forceRedirectUrl, signUpForceRedirectUrl }: { forceRedirectUrl: string; signUpForceRedirectUrl: string }) {
  const node = useRef<HTMLDivElement>(null);
  const ua = useSyncExternalStore(noSubscribe, () => navigator.userAgent, () => "");
  const inApp = useMemo(() => inAppBrowser(ua), [ua]);
  const hideSocial = !!inApp;
  useEffect(() => {
    requireClerk();
    if (node.current) setSignInSlot({ node: node.current, forceRedirectUrl, signUpForceRedirectUrl, hideSocial });
    return () => setSignInSlot(null);
  }, [forceRedirectUrl, signUpForceRedirectUrl, hideSocial]);
  return <>{inApp && <InAppNotice browser={inApp} />}<div ref={node} /></>;
}
