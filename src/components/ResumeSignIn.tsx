"use client";
import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { RESUME_KEY, RESUME_TRIED, resumeHint, resumeTarget } from "@/lib/resume-sign-in";

/** Signs a returning Google user back in when their session has run out. Google is asked with prompt=none, so it either answers silently or the visit stays signed out; nothing is ever shown. */
export function ResumeSignIn() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const first = useRef(true);
  useEffect(() => {
    if (!isLoaded) return;
    // Only the state a visit starts in can leave the page: a session that ends mid-visit waits for the next load.
    const arriving = first.current;
    first.current = false;
    try {
      if (isSignedIn) { const hint = resumeHint(user.externalAccounts); if (hint) localStorage.setItem(RESUME_KEY, hint); else localStorage.removeItem(RESUME_KEY); return; }
      const signIn = clerk.client?.signIn;
      if (!arriving || !signIn) return;
      const stored = localStorage.getItem(RESUME_KEY);
      // Back from Google: finish the sign-in if it went through.
      if (stored === RESUME_TRIED) { if (signIn.status === "complete" && signIn.createdSessionId) void clerk.setActive({ session: signIn.createdSessionId }); return; }
      const googleId = resumeTarget(stored);
      if (!googleId || window.self !== window.top) return;
      localStorage.setItem(RESUME_KEY, RESUME_TRIED);
      const here = clerk.buildUrlWithAuth(window.location.href);
      void signIn.create({ strategy: "oauth_google", redirectUrl: here, actionCompleteRedirectUrl: here, oidcPrompt: "none", oidcLoginHint: googleId })
        .then((s) => { const url = s.firstFactorVerification.externalVerificationRedirectURL; if (url) window.location.replace(url.href); })
        .catch((e) => console.error("Resuming sign-in failed", e));
    } catch { /* private mode */ }
  }, [clerk, isLoaded, isSignedIn, user]);
  return null;
}

/** An explicit sign-out is a choice: forget the account so the next visit stays signed out. */
export function forgetResume() { try { localStorage.removeItem(RESUME_KEY); } catch { /* private mode */ } }
