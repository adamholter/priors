/** Pure rules for the `requests` table, shared by `requests.ts`, the form on `/request` and the tests. No Convex imports. */
export const MAX_TEXT = 2000, MAX_URL = 500, MAX_CONTACT = 120;
/** Stored requests per rolling 24 hours, all visitors together, and the wait between two from one sender. */
export const DAILY_CAP = 200, COOLDOWN_MS = 30_000;

export type RequestKind = "benchmark" | "feature";
export interface CleanRequest { kind: RequestKind; text: string; url?: string; contact?: string }
export type Cleaned = { ok: true; value: CleanRequest } | { ok: false; error: string };

// Everything below a space except tab and newline, plus DEL.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** An http(s) address as typed, with `https://` added when the scheme is left off. Null when it is not one. */
export function cleanUrl(raw: string): string | null {
  const typed = raw.trim();
  if (!typed || typed.length > MAX_URL || /[\s\u0000-\u001f\u007f]/.test(typed)) return null;
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(typed) ? typed : `https://${typed}`); } catch { return null; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || !/^[^.]+(\.[^.]+)+$/.test(url.hostname)) return null;
  return url.href.length <= MAX_URL ? url.href : null;
}

/** What a request must be before it is stored: a known kind, some text within the cap, and a real link when one is given. */
export function cleanRequest(input: { kind: string; text: string; url?: string; contact?: string }): Cleaned {
  if (input.kind !== "benchmark" && input.kind !== "feature") return { ok: false, error: "Choose a benchmark or a feature." };
  const text = input.text.replace(/\r\n?/g, "\n").replace(CONTROL, "").trim();
  if (!text) return { ok: false, error: "Write what you are asking for." };
  if (text.length > MAX_TEXT) return { ok: false, error: `Keep it under ${MAX_TEXT} characters.` };
  const value: CleanRequest = { kind: input.kind, text };
  if (input.url?.trim()) {
    const url = cleanUrl(input.url);
    if (!url) return { ok: false, error: "The link must be a web address, like https://example.com/leaderboard." };
    value.url = url;
  }
  const contact = (input.contact ?? "").replace(CONTROL, "").replace(/\s+/g, " ").trim();
  if (contact.length > MAX_CONTACT) return { ok: false, error: `Keep the contact under ${MAX_CONTACT} characters.` };
  if (contact) value.contact = contact;
  return { ok: true, value };
}

/** Whose cooldown a request counts against: the account when signed in, else the id the browser made for itself. */
export function clientKey(subject: string | undefined, client: string | undefined): string {
  if (subject) return `u:${subject}`;
  return client && /^[A-Za-z0-9_-]{8,64}$/.test(client) ? `c:${client}` : "anon";
}

export type LimitReason = "cooldown" | "full";
export const LIMIT_MESSAGE: Record<LimitReason, string> = {
  cooldown: "You just sent one. Wait half a minute, then send the next.",
  full: "Too many requests came in today. Try again tomorrow.",
};
/** Why a request cannot be stored right now, or null. `lastAt` is this sender's last request, `dayCount` everyone's in the last 24 hours. */
export function limitOf({ now, lastAt, dayCount, cap = DAILY_CAP, cooldown = COOLDOWN_MS }: { now: number; lastAt?: number; dayCount: number; cap?: number; cooldown?: number }): LimitReason | null {
  if (lastAt !== undefined && now - lastAt < cooldown) return "cooldown";
  return dayCount >= cap ? "full" : null;
}

/** Whether `given` is the reader's token. False while none is configured. The loop never stops early, so timing says nothing about where they differ. */
export function tokenMatches(given: string, want: string | undefined): boolean {
  if (!want || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
