import type { Metadata } from "next";
import { DM_Sans, Inter, JetBrains_Mono, Newsreader, Source_Serif_4 } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_SCRIPT } from "@/components/Theme";

const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const jetbrains = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
// Page-theme fonts: only downloaded when a themed page actually uses them.
const switzer = localFont({ variable: "--font-switzer", preload: false, display: "swap", src: [{ path: "./fonts/switzer-400.woff2", weight: "400", style: "normal" }, { path: "./fonts/switzer-500.woff2", weight: "500", style: "normal" }, { path: "./fonts/switzer-600.woff2", weight: "600", style: "normal" }] });
const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], preload: false });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: { default: "priors", template: "%s · priors" },
  description: "Build your own index of AI models. Pick the benchmarks that matter to you, weight them, and share the ranking.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:48740"),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable} ${jetbrains.variable} ${switzer.variable} ${dmSans.variable} ${sourceSerif.variable} h-full antialiased`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} suppressHydrationWarning /></head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
