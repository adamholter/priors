/**
 * Pre-renders the intro dialog's share cards to public/intro/<design>.png (and <design>-dark.png) from the latest snapshot,
 * so the first visit shows them instantly instead of waiting on /og.
 * Usage: npx tsx scripts/scrape/intro-cards.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import type { Snapshot } from "../../src/data/types";
import { defaultConfig } from "../../src/engine";
import { renderShareCard } from "../../src/lib/og";
import { INTRO_CARDS } from "../../src/lib/share-designs";

async function main() {
  const snapshot = JSON.parse(gunzipSync(await readFile(path.resolve("data/snapshots/latest.json.gz"))).toString()) as Snapshot;
  const out = path.resolve("public/intro");
  await mkdir(out, { recursive: true });
  const index = { ...defaultConfig(snapshot), name: "My priors" };
  for (const design of INTRO_CARDS) for (const scheme of ["light", "dark"] as const) {
    const res = await renderShareCard(snapshot, index, { name: "" }, { design, scheme });
    if (!res.ok) throw new Error(`${design} ${scheme}: ${res.status}`);
    await writeFile(path.join(out, `${design}${scheme === "dark" ? "-dark" : ""}.png`), Buffer.from(await res.arrayBuffer()));
  }
  console.log(`intro cards: ${INTRO_CARDS.join(", ")} (${snapshot.date})`);
}
void main();
