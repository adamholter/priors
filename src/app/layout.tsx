import type { Metadata, Viewport } from "next";
import { DM_Sans, Inter, JetBrains_Mono, Newsreader, Source_Serif_4 } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_SCRIPT } from "@/components/Theme";
import { THEME_CRITICAL_CSS } from "@/lib/theme-critical";
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME } from "@/lib/site-meta";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
// Page-theme fonts: only downloaded when a themed page actually uses them.
const switzer = localFont({ variable: "--font-switzer", preload: false, display: "swap", src: [{ path: "./fonts/switzer-400.woff2", weight: "400", style: "normal" }, { path: "./fonts/switzer-500.woff2", weight: "500", style: "normal" }, { path: "./fonts/switzer-600.woff2", weight: "600", style: "normal" }] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], preload: false });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], preload: false });

// Tells the browser both schemes are supported, so its own canvas, scrollbars and form controls start dark for a dark system.
export const viewport: Viewport = { colorScheme: "light dark" };

// Routes set their own preview through pageMeta; this is what a link shows when one doesn't.
export const metadata: Metadata = {
  title: { default: "priors", template: "%s · priors" },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:48740"),
  openGraph: { siteName: SITE_NAME, type: "website", title: SITE_NAME, description: SITE_DESCRIPTION, images: [SITE_IMAGE] },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION, images: [{ url: SITE_IMAGE.url, alt: SITE_IMAGE.alt }] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable} ${switzer.variable} ${dmSans.variable} ${sourceSerif.variable} h-full antialiased`} suppressHydrationWarning>
      <head><style dangerouslySetInnerHTML={{ __html: THEME_CRITICAL_CSS }} /><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} suppressHydrationWarning /></head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
