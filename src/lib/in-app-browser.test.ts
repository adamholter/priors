import { describe, expect, it } from "vitest";
import { inAppBrowser, openInBrowserHref } from "./in-app-browser";

// User agents seen on mypriors.com's sign-in page.
const X_ANDROID = "Mozilla/5.0 (Linux; Android 17; SM-S942U Build/CP2A.260605.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/158.0.8127.42 Mobile Safari/537.36";
const X_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/24C5037i Twitter for iPhone/12.44";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Mobile/15E148 Safari/604.1";
const CHROME_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 27_2_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/156.0.8078.54 Mobile/15E148 Safari/604.1";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36";
const FB_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/520.0.0.40.97;FBBV/1]";

describe("inAppBrowser", () => {
  it("spots app browsers, naming the app when it says who it is", () => {
    expect(inAppBrowser(X_ANDROID)).toEqual({ app: "", os: "android" });
    expect(inAppBrowser(X_IOS)).toEqual({ app: "X", os: "ios" });
    expect(inAppBrowser(FB_IOS)).toEqual({ app: "Facebook", os: "ios" });
  });
  it("leaves real browsers alone", () => {
    for (const ua of [SAFARI, CHROME_IOS, CHROME_ANDROID, DESKTOP, ""]) expect(inAppBrowser(ua), ua).toBeNull();
  });
});

describe("openInBrowserHref", () => {
  it("opens Safari on iPhone and the default browser on Android, keeping the path and query", () => {
    expect(openInBrowserHref("https://mypriors.com/sign-in?x=1", "ios")).toBe("x-safari-https://mypriors.com/sign-in?x=1");
    expect(openInBrowserHref("https://mypriors.com/sign-in?x=1", "android")).toBe("intent://mypriors.com/sign-in?x=1#Intent;scheme=https;S.browser_fallback_url=https%3A%2F%2Fmypriors.com%2Fsign-in%3Fx%3D1;end");
  });
});
