"use client";
import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { RESUME_KEY, RESUME_TRIED, resumeTarget, resumeWhileSignedIn, signedOutMark } from "@/lib/resume-sign-in";

/** Signs a returning Google user back in when their session has run out. Google is asked with prompt=none, so it either answers silently or the visit stays signed out; nothing is ever shown. */
export function ResumeSignIn() {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, user } = useUser();
  const { sessionId } = useAuth();
  const first = useRef(true);
  useEffect(() => {
    if (!isLoaded) return;
    // Only the state a visit starts in can leave the page: a session that ends mid-visit waits for the next load.
    const arriving = first.current;
    first.current = false;
    try {
      if (isSignedIn) { const next = resumeWhileSignedIn(localStorage.getItem(RESUME_KEY), sessionId, user.externalAccounts); if (next) localStorage.setItem(RESUME_KEY, next); else localStorage.removeItem(RESUME_KEY); return; }
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
  }, [clerk, isLoaded, isSignedIn, user, sessionId]);
  return null;
}

/** An explicit sign-out is a choice: the next visit stays signed out. The mark names the session, so the signed-in state cannot re-arm the resume while the sign-out is still in flight. */
export function useForgetResume() {
  const { sessionId } = useAuth();
  return () => { try { localStorage.setItem(RESUME_KEY, signedOutMark(sessionId)); } catch { /* private mode */ } };
}
