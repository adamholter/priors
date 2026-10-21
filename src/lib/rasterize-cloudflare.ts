import { initWasm, Resvg } from "@resvg/resvg-wasm";
import wasm from "../../node_modules/@resvg/resvg-wasm/index_bg.wasm?module";
import { readRuntimeFile } from "./runtime-files";

const CARD_FONTS = ["Newsreader-400.ttf", "Inter-400.ttf", "Inter-500.ttf", "Inter-600.ttf", "JetBrainsMono-400.ttf", "JetBrainsMono-500.ttf"];
let ready: Promise<Buffer[]> | undefined;

export async function rasterize(svg: string, bg: string): Promise<Buffer> {
  ready ??= Promise.all([
    initWasm(wasm),
    Promise.all(CARD_FONTS.map(f => readRuntimeFile(`src/lib/og-fonts/${f}`))),
  ]).then(([, fonts]) => fonts).catch(error => { ready = undefined; throw error; });
  const fontBuffers = await ready;
  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: 2400 }, background: bg,
    font: { fontBuffers, defaultFontFamily: "Inter", sansSerifFamily: "Inter", serifFamily: "Newsreader", monospaceFamily: "JetBrains Mono" },
  });
  try {
    const image = renderer.render();
    try { return Buffer.from(image.asPng()); } finally { image.free(); }
  } finally { renderer.free(); }
}
