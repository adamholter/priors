/** Clerk's free plan ends every session after 7 days. While a Google user is signed in we keep their Google account id on the device, so a later visit with an expired session can ask Google to sign them back in with no prompt. Password and email-code users cannot be resumed: those need the person. */
export const RESUME_KEY = "priors:resume";
/** Stored once an attempt has started, so each expiry gets one try and a refusal from Google never loops. */
export const RESUME_TRIED = "tried";
const GOOGLE = "google:";

type Account = { provider: string; providerUserId: string; verification?: { status: string | null } | null };

/** What to store while signed in, or null when the account has no verified Google sign-in. */
export function resumeHint(accounts: Account[]): string | null {
  const google = accounts.find((a) => a.provider === "google" && a.verification?.status === "verified" && a.providerUserId);
  return google ? GOOGLE + google.providerUserId : null;
}

/** Stored when the user signs out of a session, so nothing re-arms the resume while that session winds down. A later sign-in is a new session and arms it again. */
export const signedOutMark = (sessionId: string | null | undefined) => `off:${sessionId ?? ""}`;

/** What the key should hold while signed in: the Google hint, unless this very session was just signed out by hand. */
export function resumeWhileSignedIn(stored: string | null, sessionId: string | null | undefined, accounts: Account[]): string | null {
  return stored === signedOutMark(sessionId) ? stored : resumeHint(accounts);
}

/** The Google account id to ask for, or null when there is nothing to resume. */
export function resumeTarget(stored: string | null): string | null {
  return stored?.startsWith(GOOGLE) ? stored.slice(GOOGLE.length) || null : null;
}
