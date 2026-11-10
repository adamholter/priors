/** Pure rules for the `requests` table, shared by `requests.ts`, the form on `/request` and the tests. No Convex imports. */
export const MAX_TEXT = 5000, MAX_URL = 500, MAX_CONTACT = 120, MAX_CONTEXT = 600;
/** Attachments: how many a report may carry, how big each may be, and how many one sender and everyone together may upload. */
export const MAX_FILES = 5, MAX_FILE_BYTES = 15 * 1024 * 1024, MAX_FILE_NAME = 120, FILES_PER_HOUR = 20, FILES_DAILY_CAP = 200, FILES_DAILY_BYTES = 1024 * 1024 * 1024;
/** Stored requests per rolling 24 hours, all visitors together, and the wait between two from one sender. */
export const DAILY_CAP = 200, COOLDOWN_MS = 30_000;
/**
 * The share of the daily cap that senders without an account may use. A browser's id is its own word, so a script can
 * mint a new one per request and walk past the cooldown; this keeps the rest of the day's room for signed-in people.
 */
export const ANON_SHARE = 0.75;
export const anonCapOf = (cap: number) => Math.floor(cap * ANON_SHARE);

export const REQUEST_KINDS = ["bug", "feature", "benchmark", "other"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
/** `context` is what the form adds to a bug report by itself: the browser, the screen and the page the sender came from. */
export interface CleanRequest { kind: RequestKind; text: string; url?: string; contact?: string; context?: string }
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
export function cleanRequest(input: { kind: string; text: string; url?: string; contact?: string; context?: string }): Cleaned {
  if (!(REQUEST_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "Choose what this is." };
  const kind = input.kind as RequestKind;
  const text = input.text.replace(/\r\n?/g, "\n").replace(CONTROL, "").trim();
  if (!text) return { ok: false, error: kind === "bug" ? "Write what went wrong." : "Write what you are asking for." };
  if (text.length > MAX_TEXT) return { ok: false, error: `Keep it under ${MAX_TEXT} characters.` };
  const value: CleanRequest = { kind, text };
  if (input.url?.trim()) {
    const url = cleanUrl(input.url);
    if (!url) return { ok: false, error: "The link must be a web address, like https://example.com/leaderboard." };
    value.url = url;
  }
  const contact = (input.contact ?? "").replace(CONTROL, "").replace(/\s+/g, " ").trim();
  if (contact.length > MAX_CONTACT) return { ok: false, error: `Keep the contact under ${MAX_CONTACT} characters.` };
  if (contact) value.contact = contact;
  // Written by the form, not the sender, so it is cut to size rather than refused.
  const context = (input.context ?? "").replace(CONTROL, "").replace(/\s+/g, " ").trim().slice(0, MAX_CONTEXT);
  if (context) value.context = context;
  return { ok: true, value };
}

/** A file's name as it is stored and later written to disk: no folders, no control characters, never empty, never a dot file. */
export function cleanFileName(raw: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/\s+/g, " ").trim().replace(/^\.+/, "");
  if (!base) return "file";
  if (base.length <= MAX_FILE_NAME) return base;
  const dot = base.lastIndexOf("."), ext = dot > 0 && base.length - dot <= 10 ? base.slice(dot) : "";
  return base.slice(0, MAX_FILE_NAME - ext.length) + ext;
}

/**
 * What an attachment is, from its first bytes: a picture, a PDF or a video. The type the browser declared is never used.
 * Anything else has to be plain text (`isText`): a log, JSON, a HAR file, CSV. Programs, archives and documents that can
 * carry script (SVG, HTML is stored as text and never served as a page) do not pass.
 */
export function sniffFile(b: Uint8Array): string | undefined {
  const at = (from: number, text: string) => [...text].every((c, i) => b[from + i] === c.charCodeAt(0));
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "image/gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(0, "%PDF-")) return "application/pdf";
  if ([0x1a, 0x45, 0xdf, 0xa3].every((v, i) => b[i] === v)) return "video/webm";
  if (at(4, "ftyp")) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "mif1", "msf1"].includes(brand)) return "image/heic";
    return brand === "qt  " ? "video/quicktime" : "video/mp4";
  }
  return undefined;
}
/** Whether the bytes are text a person can read: valid UTF-8 with no NUL and next to no other control characters. */
export function isText(bytes: Uint8Array): boolean {
  if (!bytes.length) return false;
  let odd = 0;
  for (const v of bytes) { if (v === 0) return false; if (v < 9 || (v > 13 && v < 32 && v !== 27)) odd++; }
  if (odd > bytes.length / 100) return false;
  try { new TextDecoder("utf-8", { fatal: true }).decode(bytes); return true; } catch { return false; }
}
export const FILE_KINDS = "an image, a PDF, a video, or a text file such as a log";
/**
 * Why a sender cannot upload another file right now, or null. `hourCount` is theirs in the last hour; `dayCount` and
 * `dayBytes` are everyone's in the last day, uploads still arriving included, and `size` is the one being asked for.
 */
export function fileLimitOf({ hourCount, dayCount, dayBytes = 0, size = 0, perHour = FILES_PER_HOUR, cap = FILES_DAILY_CAP, bytes = FILES_DAILY_BYTES }: { hourCount: number; dayCount: number; dayBytes?: number; size?: number; perHour?: number; cap?: number; bytes?: number }): string | null {
  if (hourCount >= perHour) return "Too many files from you in the last hour. Try again later.";
  return dayCount >= cap || dayBytes + size > bytes ? "Too many files came in today. Send it without the file, or try again tomorrow." : null;
}
/**
 * Whose hourly limit an upload counts against: the address it came from when the server can see one, else the id the
 * browser made for itself (which is the sender's own word, so the daily caps are the real stop). The address is the last
 * one in `x-forwarded-for`, the one the host's own edge wrote: anything before it is whatever the sender chose to send.
 * (Convex replaces the header outright today, checked 2026-11-10 with a forged one; this holds if it ever appends.)
 */
export function uploaderKey(forwardedFor: string | null | undefined, client: string | null | undefined): string {
  const ip = (forwardedFor ?? "").split(",").pop()!.trim();
  if (/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return `ip:${ip}`;
  return client && /^[A-Za-z0-9_-]{8,64}$/.test(client) ? `c:${client}` : "anon";
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
/** Whether a cooldown key belongs to a signed-in account (`clientKey`). */
export const isAccountKey = (key: string | undefined) => !!key && key.startsWith("u:");
/**
 * Why a request cannot be stored right now, or null. `lastAt` is this sender's last request; `dayCount` is everyone's
 * in the last 24 hours and `anonCount` the part of it sent without an account. A sender without an account stops at
 * `anonCapOf(cap)`, a signed-in one at `cap`.
 */
export function limitOf({ now, lastAt, dayCount, anonCount = dayCount, signedIn = false, cap = DAILY_CAP, cooldown = COOLDOWN_MS }: { now: number; lastAt?: number; dayCount: number; anonCount?: number; signedIn?: boolean; cap?: number; cooldown?: number }): LimitReason | null {
  if (lastAt !== undefined && now - lastAt < cooldown) return "cooldown";
  if (dayCount >= cap) return "full";
  return !signedIn && anonCount >= anonCapOf(cap) ? "full" : null;
}

/** Whether `given` is the reader's token. False while none is configured. The loop never stops early, so timing says nothing about where they differ. */
export function tokenMatches(given: string, want: string | undefined): boolean {
  if (!want || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
