"use client";
import { useEffect, useRef } from "react";
import { requireClerk, setSignInSlot } from "@/lib/auth";

/** Where Clerk's sign-in form appears, once its code arrives. */
export function SignInForm({ forceRedirectUrl, signUpForceRedirectUrl }: { forceRedirectUrl: string; signUpForceRedirectUrl: string }) {
  const node = useRef<HTMLDivElement>(null);
  useEffect(() => {
    requireClerk();
    if (node.current) setSignInSlot({ node: node.current, forceRedirectUrl, signUpForceRedirectUrl });
    return () => setSignInSlot(null);
  }, [forceRedirectUrl, signUpForceRedirectUrl]);
  return <div ref={node} />;
}
