import { headers } from "next/headers";

/** Link-preview crawlers that need a tiny HTML response (they cap page size). Search engines are excluded. */
const BOT_RE = /twitterbot|facebookexternalhit|facebot|linkedinbot|slackbot|slack-imgproxy|discordbot|telegrambot|whatsapp|applebot|redditbot|embedly|skypeuripreview|iframely|bluesky|cardyb|mastodon|pinterest|vkshare/i;

export async function isPreviewBot(): Promise<boolean> {
  const h = await headers();
  return BOT_RE.test(h.get("user-agent") ?? "");
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
