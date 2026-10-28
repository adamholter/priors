import { ConvexHttpClient } from "convex/browser";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { api } from "../../../../convex/_generated/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false } };

/** Short link: sends the visitor (and link-preview crawlers, which follow redirects) to the stored full URL, query and hash kept. */
export default async function ShortLink({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const path = url ? await new ConvexHttpClient(url).query(api.shortLinks.resolve, { slug }).catch(() => null) : null;
  if (!path || !path.startsWith("/") || path.startsWith("//")) notFound();
  permanentRedirect(path as Parameters<typeof permanentRedirect>[0]);
}
