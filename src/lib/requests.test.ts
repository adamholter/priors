import { describe, expect, it } from "vitest";
import { anonCapOf, cleanRequest, cleanUrl, clientKey, COOLDOWN_MS, DAILY_CAP, isAccountKey, LIMIT_MESSAGE, limitOf, MAX_CONTACT, MAX_TEXT, MAX_URL, tokenMatches } from "../../convex/requestRules";

describe("cleanRequest", () => {
  it("keeps a plain request and drops empty optional fields", () => {
    expect(cleanRequest({ kind: "benchmark", text: "  Vending-Bench 2  ", url: "  ", contact: "" })).toEqual({ ok: true, value: { kind: "benchmark", text: "Vending-Bench 2" } });
    expect(cleanRequest({ kind: "feature", text: "Pin two models", url: "example.com/a", contact: " @someone " })).toEqual({ ok: true, value: { kind: "feature", text: "Pin two models", url: "https://example.com/a", contact: "@someone" } });
  });
  it("needs a known kind and some text", () => {
    expect(cleanRequest({ kind: "spam", text: "x" }).ok).toBe(false);
    for (const text of ["", "   ", "\n\t\n", "\u0000\u0007"]) expect(cleanRequest({ kind: "feature", text }).ok).toBe(false);
  });
  it("caps the text at 2000 characters, counted after trimming", () => {
    expect(cleanRequest({ kind: "feature", text: "a".repeat(MAX_TEXT) }).ok).toBe(true);
    expect(cleanRequest({ kind: "feature", text: ` ${"a".repeat(MAX_TEXT)} ` }).ok).toBe(true);
    expect(cleanRequest({ kind: "feature", text: "a".repeat(MAX_TEXT + 1) })).toEqual({ ok: false, error: "Keep it under 2000 characters." });
  });
  it("keeps line breaks and strips control characters", () => {
    const r = cleanRequest({ kind: "feature", text: "one\r\ntwo\u0000\u001b[31m\tthree" });
    expect(r).toEqual({ ok: true, value: { kind: "feature", text: "one\ntwo[31m\tthree" } });
  });
  it("refuses a link that is not a web address and a contact that is too long", () => {
    expect(cleanRequest({ kind: "benchmark", text: "x", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(cleanRequest({ kind: "benchmark", text: "x", contact: "a".repeat(MAX_CONTACT + 1) }).ok).toBe(false);
    expect(cleanRequest({ kind: "benchmark", text: "x", contact: "a".repeat(MAX_CONTACT) }).ok).toBe(true);
  });
  it("flattens a contact to one line", () => {
    expect(cleanRequest({ kind: "feature", text: "x", contact: "me@example.com\n\u0000 @me" })).toMatchObject({ value: { contact: "me@example.com @me" } });
  });
  it("gives back the same request when run on its own output, as the server does to what the form sends", () => {
    const once = cleanRequest({ kind: "benchmark", text: " a\r\nb ", url: "Example.com/x?y=1#z", contact: "  @a   b " });
    expect(once.ok && cleanRequest(once.value)).toEqual(once);
  });
});

describe("cleanUrl", () => {
  it("takes http and https addresses, adding https when the scheme is missing", () => {
    expect(cleanUrl("https://arena.ai/leaderboard?x=1#top")).toBe("https://arena.ai/leaderboard?x=1#top");
    expect(cleanUrl("http://example.com")).toBe("http://example.com/");
    expect(cleanUrl(" arxiv.org/abs/2501.00001 ")).toBe("https://arxiv.org/abs/2501.00001");
  });
  it("refuses other schemes, credentials, bare hosts and anything with spaces or control characters", () => {
    for (const bad of ["", "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "ftp://example.com/x", "mailto:a@b.co", "https://user:pw@example.com", "https://localhost/x", "localhost:3000/x", "not a url", "https://exa mple.com", "https://example.com/\nx", "https://", "example"]) expect(cleanUrl(bad), bad).toBeNull();
  });
  it("caps the length", () => {
    const base = "https://example.com/";
    expect(cleanUrl(base + "a".repeat(MAX_URL - base.length))).not.toBeNull();
    expect(cleanUrl(base + "a".repeat(MAX_URL - base.length + 1))).toBeNull();
  });
});

describe("limits", () => {
  const now = 1_800_000_000_000;
  it("lets a first request through under the cap", () => {
    expect(limitOf({ now, dayCount: 0 })).toBeNull();
    expect(limitOf({ now, dayCount: anonCapOf(DAILY_CAP) - 1 })).toBeNull();
    expect(limitOf({ now, dayCount: DAILY_CAP - 1, anonCount: 0, signedIn: true })).toBeNull();
  });
  it("stops senders without an account before the cap, leaving room for signed-in people", () => {
    const anon = anonCapOf(DAILY_CAP);
    expect(anon).toBeLessThan(DAILY_CAP);
    // A script minting a new browser id per request never meets the cooldown; it meets this.
    expect(limitOf({ now, dayCount: anon, anonCount: anon })).toBe("full");
    expect(limitOf({ now, dayCount: anon, anonCount: anon, signedIn: true })).toBeNull();
    // Signed-in requests do not use up the room of people without an account.
    expect(limitOf({ now, dayCount: anon, anonCount: anon - 1 })).toBeNull();
    expect(limitOf({ now, dayCount: 3, anonCount: 3, cap: 4 })).toBe("full");
    expect(limitOf({ now, dayCount: 3, anonCount: 3, cap: 4, signedIn: true })).toBeNull();
    expect(isAccountKey(clientKey("user_1", "x"))).toBe(true);
    for (const key of [clientKey(undefined, "0b1c2d3e-aaaa"), clientKey(undefined, undefined), undefined]) expect(isAccountKey(key)).toBe(false);
  });
  it("holds one sender to a request per cooldown", () => {
    expect(limitOf({ now, lastAt: now - 1, dayCount: 1 })).toBe("cooldown");
    expect(limitOf({ now, lastAt: now - COOLDOWN_MS + 1, dayCount: 1 })).toBe("cooldown");
    expect(limitOf({ now, lastAt: now - COOLDOWN_MS, dayCount: 1 })).toBeNull();
  });
  it("stops everyone at the daily cap", () => {
    expect(limitOf({ now, dayCount: DAILY_CAP })).toBe("full");
    expect(limitOf({ now, dayCount: DAILY_CAP, anonCount: 0, signedIn: true })).toBe("full");
    expect(limitOf({ now, dayCount: 3, cap: 3 })).toBe("full");
    expect(limitOf({ now, lastAt: now - 5, dayCount: DAILY_CAP })).toBe("cooldown");
  });
  it("has a sentence for each refusal, with no em dash", () => {
    for (const text of Object.values(LIMIT_MESSAGE)) { expect(text.length).toBeGreaterThan(10); expect(text).not.toMatch(/—/); }
  });
  it("keys the cooldown on the account, then on a well-formed browser id, else one shared bucket", () => {
    expect(clientKey("user_123", "browser-id-1")).toBe("u:user_123");
    expect(clientKey(undefined, "0b1c2d3e-aaaa-bbbb-cccc-000000000000")).toBe("c:0b1c2d3e-aaaa-bbbb-cccc-000000000000");
    for (const bad of [undefined, "", "short", "has space in it", "x".repeat(65), "u:user_123"]) expect(clientKey(undefined, bad)).toBe("anon");
  });
});

describe("tokenMatches", () => {
  it("takes only the exact token", () => {
    expect(tokenMatches("s3cret-token", "s3cret-token")).toBe(true);
    for (const bad of ["", "s3cret-toke", "s3cret-token ", "S3cret-token", "x3cret-token", "s3cret-tokex"]) expect(tokenMatches(bad, "s3cret-token"), bad).toBe(false);
  });
  it("refuses everything while no token is configured", () => {
    for (const want of [undefined, ""]) for (const given of ["", "anything"]) expect(tokenMatches(given, want)).toBe(false);
  });
});
