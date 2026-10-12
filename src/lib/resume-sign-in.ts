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

/** The Google account id to ask for, or null when there is nothing to resume. */
export function resumeTarget(stored: string | null): string | null {
  return stored?.startsWith(GOOGLE) ? stored.slice(GOOGLE.length) || null : null;
}
