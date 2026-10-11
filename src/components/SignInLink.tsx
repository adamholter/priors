"use client";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { authEnabled } from "@/app/providers";

/** Header "Sign in" for signed-out visitors. Renders nothing while signed in or before the account loads. */
export function SignInLink({ className = "btn-quiet" }: { className?: string }) {
  return authEnabled ? <Inner className={className} /> : null;
}
function Inner({ className }: { className: string }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded || isSignedIn) return null;
  // Same key the builder uses, so sign-in returns to the page it started from.
  return <Link href="/sign-in" transitionTypes={["nav-forward"]} className={className} onClick={() => { try { localStorage.setItem("priors:return", window.location.pathname + window.location.search); } catch { /* private mode */ } }}>Sign in</Link>;
}
