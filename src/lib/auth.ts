"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { GetToken, JwtPayload, LoadedClerk, UserResource } from "@clerk/shared/types";
import { RESUME_KEY, RESUME_TRIED, resumeTarget, signedOutMark } from "@/lib/resume-sign-in";

/**
 * Sign-in state for the whole app, without Clerk's code. Clerk's client (over 800 KB) loads only for a visitor who
 * needs it: a session cookie, a sign-in to resume, or a sign-in page (`components/auth/ClerkLayer.tsx`). Everyone else
 * is anonymous from the first client render. These hooks replace Clerk's own and read the same fields.
 */
export const authEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export interface AuthState {
  isLoaded: boolean; isSignedIn: boolean | undefined;
  userId: string | null | undefined; sessionId: string | null | undefined;
  sessionClaims: JwtPayload | null | undefined;
  orgId: string | null | undefined; orgRole: string | null | undefined;
  user: UserResource | null | undefined;
  getToken: GetToken;
  clerk: LoadedClerk | null;
}
const noToken: GetToken = async () => null;
const blank = { userId: undefined, sessionId: undefined, sessionClaims: undefined, orgId: undefined, orgRole: undefined, user: undefined, getToken: noToken, clerk: null };
const PENDING: AuthState = { ...blank, isLoaded: false, isSignedIn: undefined };
const ANONYMOUS: AuthState = { ...blank, isLoaded: true, isSignedIn: false, userId: null, sessionId: null, sessionClaims: null, user: null };

/** What says this browser needs Clerk. A stale cookie costs one download, after which Clerk corrects it. */
export function clerkNeeded({ cookie, resume, url, pathname }: { cookie: string; resume: string | null; url: string; pathname: string }): boolean {
  // Clerk's cookies, readable from the page: a session token, or the last sign-in time (0 once signed out). Some setups add a suffix to the name.
  if (/(?:^|;\s*)__session(?:_[^=]*)?=[^;]/.test(cookie) || /(?:^|;\s*)__client_uat(?:_[^=]*)?=[1-9]/.test(cookie)) return true;
  // A Google account to sign back in, or a sign-in to finish on the way back from Google (`ResumeSignIn`).
  if (resume === RESUME_TRIED || resumeTarget(resume)) return true;
  // Clerk's own return trips (OAuth, email links, tickets) and its pages.
  return /[?&#]__clerk_/.test(url) || /^\/sign-(?:in|up)(?:\/|$)/.test(pathname);
}

function detect(): boolean {
  let resume: string | null = null;
  try { resume = localStorage.getItem(RESUME_KEY); } catch { /* private mode */ }
  return authEnabled && clerkNeeded({ cookie: document.cookie, resume, url: location.href, pathname: location.pathname });
}

let wanted: boolean | null = null, live: AuthState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const isWanted = () => wanted ?? (wanted = detect());
const getState = () => live ?? (isWanted() ? PENDING : ANONYMOUS);

/** Loads Clerk for this tab. It stays loaded for the rest of the visit. */
export function requireClerk() { if (!isWanted()) { wanted = true; emit(); } }
/** Clerk's state, from inside `ClerkLayer`. */
export function publishAuth(state: AuthState) { live = state; emit(); }

export const useClerkWanted = () => useSyncExternalStore(subscribe, isWanted, () => false);
export const useAuth = () => useSyncExternalStore(subscribe, getState, () => PENDING);
export const useUser = () => { const { isLoaded, isSignedIn, user } = useAuth(); return { isLoaded, isSignedIn, user }; };
export const useClerk = () => useAuth().clerk;

/** Another tab signing in, or coming back to a tab after signing in elsewhere: pick the session up. */
export function useClerkDetection() {
  useEffect(() => {
    if (!authEnabled) return;
    const check = () => { if (!wanted && detect()) requireClerk(); };
    check();
    addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, []);
}

/** An explicit sign-out is a choice: the next visit stays signed out. The mark names the session, so the signed-in state cannot re-arm the resume while the sign-out is still in flight. */
export function useForgetResume() {
  const { sessionId } = useAuth();
  return () => { try { localStorage.setItem(RESUME_KEY, signedOutMark(sessionId)); } catch { /* private mode */ } };
}

/** Clerk's sign-in form is drawn into a node of the page from inside `ClerkLayer`, whose provider it needs. */
export interface SignInSlot { node: HTMLElement; forceRedirectUrl: string; signUpForceRedirectUrl: string }
let slot: SignInSlot | null = null;
export function setSignInSlot(next: SignInSlot | null) { slot = next; emit(); }
export const useSignInSlot = () => useSyncExternalStore(subscribe, () => slot, () => null);
