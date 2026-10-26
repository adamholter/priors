import { headers } from "next/headers";

/** Link-preview crawlers that need a tiny HTML response (they cap page size). Search engines are excluded. */
const BOT_RE = /twitterbot|facebookexternalhit|facebot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|applebot|redditbot|embedly|skypeuripreview|iframely|bluesky|cardyb|mastodon|pinterest|vkshare/i;

const SEARCH_RE = /googlebot|bingbot|duckduckbot|yandex|baiduspider/i;
const BROWSER_RE = /applewebkit|gecko\/|chrome\/|safari\/|firefox\//i;

export async function isPreviewBot(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  // Named preview crawlers, plus anything that isn't a real browser (X also fetches with a bare "Mozilla/5.0").
  return BOT_RE.test(ua) || (!SEARCH_RE.test(ua) && !BROWSER_RE.test(ua));
}

export async function isSearchBot(): Promise<boolean> {
  return SEARCH_RE.test((await headers()).get("user-agent") ?? "");
}

/** Minimal crawlable body — metadata in <head> is unchanged; this only avoids serializing the app. */
export function PreviewPage({ title, description, href }: { title: string; description?: string; href: string }) {
  return (
    <main style={{ padding: 48, maxWidth: 720, fontFamily: "Inter, system-ui, sans-serif", color: "#1A1A1A", background: "#FBFBF9", minHeight: "100vh" }}>
      <h1 style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 40, fontWeight: 400, lineHeight: 1.1 }}>{title}</h1>
      {description ? <p style={{ marginTop: 16, fontSize: 17, lineHeight: 1.5 }}>{description}</p> : null}
      <p style={{ marginTop: 24 }}><a href={href} style={{ color: "#2F4FB0" }}>{href}</a></p>
    </main>
  );
}
