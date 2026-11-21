/**
 * Apps like X, Facebook and Instagram open links in their own built-in browser. Google refuses to sign anyone in there, so the
 * Google step jumps out to the phone's real browser, which keeps its own cookies and has never seen the sign-in that started
 * inside the app; Clerk then rejects the return ("authorization_invalid"). The way through is to open the page in the real
 * browser first, or to use an email sign-in, which stays inside the app.
 */
export type InAppBrowser = { app: string; os: "android" | "ios" };

const APPS: [RegExp, string][] = [
  [/\bTwitter\b|\bTwitterAndroid\b/i, "X"],
  [/\bFBAN\/|\bFBAV\/|\bFB_IAB\b|\bFBIOS\b/, "Facebook"],
  [/\bInstagram\b/, "Instagram"],
  [/\bThreads\b/, "Threads"],
  [/\bLinkedInApp\b/, "LinkedIn"],
  [/\bSnapchat\b/, "Snapchat"],
  [/\bBytedanceWebview\b|\bmusical_ly\b|\bTikTok\b/i, "TikTok"],
  [/\bLine\//, "LINE"],
  [/\bMicroMessenger\b/, "WeChat"],
  [/\bDiscord\b/, "Discord"],
  [/\bPinterest\b/, "Pinterest"],
];

/** The app whose built-in browser this is, or null in a real browser. */
export function inAppBrowser(ua: string): InAppBrowser | null {
  const ios = /\b(iPhone|iPad|iPod)\b/.test(ua), android = /\bAndroid\b/.test(ua);
  if (!ios && !android) return null;
  const os = ios ? "ios" : "android";
  const named = APPS.find(([re]) => re.test(ua))?.[1];
  if (named) return { app: named, os };
  // Android's WebView marks itself "; wv)". On iPhone an app's own web view leaves out the "Safari/" token every real browser sends.
  if (android && /; wv\)/.test(ua)) return { app: "", os };
  if (ios && /AppleWebKit/.test(ua) && !/Safari\//.test(ua)) return { app: "", os };
  return null;
}

/** A link that asks the phone to open `url` in its real browser: an Android intent with the page as fallback, or Safari's own scheme on iPhone. */
export function openInBrowserHref(url: string, os: InAppBrowser["os"]): string {
  const u = new URL(url);
  if (os === "ios") return `x-safari-${u.protocol.replace(":", "")}://${u.host}${u.pathname}${u.search}${u.hash}`;
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(":", "")};S.browser_fallback_url=${encodeURIComponent(url)};end`;
}
