import { readFile } from "node:fs/promises";
import { expect, it, vi } from "vitest";
import { rasterize as native } from "./rasterize";

vi.mock("../../node_modules/@resvg/resvg-wasm/index_bg.wasm?module", async () => ({
  default: await WebAssembly.compile(await readFile("node_modules/@resvg/resvg-wasm/index_bg.wasm")),
}));
vi.mock("./runtime-files", () => ({ readRuntimeFile: (file: string) => readFile(file) }));

it("renders the same vendored fonts and pixels with WASM and native resvg", async () => {
  const { rasterize } = await import("./rasterize-cloudflare");
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><text x="60" y="90" font-family="Inter" font-size="32">Priors 123.4</text><text x="60" y="150" font-family="Newsreader" font-size="40">Model ranking</text></svg>';
  const [expected, result] = await Promise.all([native(svg, "white"), rasterize(svg, "white")]);
  expect(result.equals(expected)).toBe(true);
  expect(result.readUInt32BE(16)).toBe(2400);
  expect(result.readUInt32BE(20)).toBe(1260);
  expect((await rasterize(svg, "white")).equals(result)).toBe(true);
});
