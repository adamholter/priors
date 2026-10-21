import path from "node:path";
import { Resvg } from "@resvg/resvg-js";

export const CARD_FONTS = ["Newsreader-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"];

export async function rasterize(svg: string, bg: string): Promise<Buffer> {
  return Buffer.from(new Resvg(svg, {
    fitTo: { mode: "width", value: 2400 }, background: bg,
    font: { fontFiles: CARD_FONTS.map(f => path.join(process.cwd(), "src/lib/og-fonts", f)), loadSystemFonts: false, defaultFontFamily: "Inter", sansSerifFamily: "Inter", serifFamily: "Newsreader", monospaceFamily: "JetBrains Mono" },
  }).render().asPng());
}
