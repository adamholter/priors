import { cp, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// These are public source files, never environment files or credentials.
const root = ".open-next/assets/cdn-cgi/priors";
// OpenNext copies .env.local as runtime defaults. Use Workers secrets exclusively,
// so a dev key can never become a production fallback or enter uploaded code.
await writeFile(".open-next/cloudflare/next-env.mjs", "export const production = {};\nexport const development = {};\nexport const test = {};\n");
await mkdir(root, { recursive: true });
for (const dir of ["data/snapshots", "src/lib/og-fonts", "public/skill"]) {
  await cp(dir, path.join(root, dir), { recursive: true });
}
await writeFile(path.join(root, "data/snapshots/dates.json"), JSON.stringify(await readdir("data/snapshots")));
await writeFile(".open-next/assets/_headers", "/_next/static/*\n  Cache-Control: public, max-age=31536000, immutable\n");
console.log("Workers snapshot archive, fonts, and skill bundled.");
