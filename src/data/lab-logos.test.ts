import { existsSync, readdirSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { LAB_LOGOS, labKey, labLogo } from "./lab-logos";
import { labIdentity } from "./lab-identity";
import { LABS } from "./normalize";
import { DARK_LAB_COLORS } from "@/components/chart/palette";
import type { Lab } from "./types";

const LOGO_DIR = "public/logos";
/** Files in public/logos that are not lab logos: a benchmark site's mark (BenchmarkPage, BenchmarkDirectory). */
const NOT_LAB_LOGOS = new Set(["gamefeel.png"]);
const snapshotLabs = (JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString("utf8")) as { labs: Lab[]; models: { labId: string }[] });
// LABS is code, so a missing logo there fails the build. The snapshot is data the scrape rewrites every two hours: a lab it adds
// must never block a deploy (it shows the letter tile until someone adds the logo), so snapshot-only labs warn instead.
const codeLabIds = [...new Set(LABS.map((l) => l.id))];
const snapshotOnlyIds = [...new Set([...snapshotLabs.labs.map((l) => l.id), ...snapshotLabs.models.map((m) => m.labId)])].filter((id) => !codeLabIds.includes(id));
const labIds = codeLabIds;
const warnSnapshotLabs = (what: string, ids: string[]) => { if (ids.length) console.warn(`[lab-logos] the latest snapshot has labs with ${what}: ${ids.join(", ")}. Add them (docs/logos.md); until then they show a letter tile.`); };

describe("lab logos", () => {
  it("covers every lab in LABS with a logo file or an explicit letter-only decision, and warns about snapshot-only labs", () => {
    const missing = labIds.filter((id) => !labLogo(id));
    expect(missing, `add these to src/data/lab-logos.ts and public/logos (docs/logos.md): ${missing.join(", ")}`).toEqual([]);
    for (const id of labIds) { const e = labLogo(id)!; expect(Boolean(e.file) !== Boolean(e.letter), `${id} needs either a file or a letter reason`).toBe(true); }
    warnSnapshotLabs("no logo entry", snapshotOnlyIds.filter((id) => !labLogo(id)));
  });

  it("points every entry at a file that exists, and every file at an entry", () => {
    for (const e of LAB_LOGOS) if (e.file) expect(existsSync(`${LOGO_DIR}/${e.file}`), `${e.id}: ${e.file} is missing`).toBe(true);
    const listed = new Set(LAB_LOGOS.flatMap((e) => (e.file ? [e.file] : [])));
    const orphans = readdirSync(LOGO_DIR).filter((f) => !listed.has(f) && !NOT_LAB_LOGOS.has(f));
    expect(orphans, "files in public/logos that no lab uses").toEqual([]);
  });

  it("keeps ids and aliases unambiguous and in the slug spelling", () => {
    const seen = new Map<string, string>();
    for (const e of LAB_LOGOS) for (const key of [e.id, ...(e.aliases ?? [])]) {
      expect(labKey(key), `${key} is not in slug form`).toBe(key);
      expect(seen.get(key), `${key} names both ${seen.get(key)} and ${e.id}`).toBeUndefined();
      seen.set(key, e.id);
    }
    for (const e of LAB_LOGOS) expect(labLogo(e.id)).toBe(e);
  });

  it("resolves the spellings scrapers and older snapshots used", () => {
    for (const [spelling, id] of [["fireworks-ai", "fireworks"], ["zhipu-ai", "zhipu"], ["Z AI", "zhipu"], ["arcee-ai", "arcee"], ["kimi", "moonshot"], ["devin", "cognition"], ["Qwen", "alibaba"], ["bytedance-seed", "bytedance"], ["Allen Institute for AI", "ai2"], ["x-ai", "xai"]]) expect(labLogo(spelling)?.id, spelling).toBe(id);
    expect(labLogo("a-lab-nobody-listed")).toBeUndefined();
  });

  it("ships clean, small files: no scripts or external references, SVG with a viewBox, PNG up to 192px", () => {
    let bytes = 0;
    for (const e of LAB_LOGOS) {
      if (!e.file) continue;
      const buf = readFileSync(`${LOGO_DIR}/${e.file}`);
      bytes += buf.length;
      expect(buf.length, `${e.file} is heavy`).toBeLessThan(20_000);
      if (e.file.endsWith(".svg")) {
        const svg = buf.toString("utf8");
        expect(svg, e.file).toMatch(/^<svg [^>]*viewBox="/);
        expect(/<script|<image|<foreignObject|\shref=|xlink:href|\son[a-z]+=|url\((?!#)|@import/i.test(svg), `${e.file} has a script or an external reference`).toBe(false);
      } else {
        expect(e.file.endsWith(".png"), e.file).toBe(true);
        expect(buf.subarray(1, 4).toString(), e.file).toBe("PNG");
        expect(buf.readUInt32BE(16), e.file).toBeLessThanOrEqual(192);
      }
    }
    expect(bytes, "the whole library").toBeLessThan(400_000);
  });

  it("flags dark marks only on files that exist", () => {
    for (const e of LAB_LOGOS) if (e.dark) expect(e.file, `${e.id} has a dark treatment but no file`).toBeTruthy();
  });

  it("gives every lab in LABS a chart color (and a dark one), except Other, and warns about snapshot-only labs without one", () => {
    const snapLabs = snapshotLabs.labs.filter((l) => !codeLabIds.includes(l.id)).map(labIdentity);
    warnSnapshotLabs("no chart color", snapLabs.filter((l) => l.id !== "other" && (!l.color || l.color.toUpperCase() === "#A3A39B" || !DARK_LAB_COLORS[l.id])).map((l) => l.id));
    const labs = LABS.map(labIdentity);
    const grey = labs.filter((l) => l.id !== "other" && (!l.color || l.color.toUpperCase() === "#A3A39B")).map((l) => l.id);
    expect(grey, "labs with no chart color: add them to LABS in src/data/normalize.ts and DARK_LAB_COLORS in src/components/chart/palette.ts").toEqual([]);
    const noDark = labs.filter((l) => l.id !== "other" && !DARK_LAB_COLORS[l.id]).map((l) => l.id);
    expect(noDark, "labs with no dark-page color").toEqual([]);
  });
});
