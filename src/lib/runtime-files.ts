import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

/** Workers serves the same public build inputs through its private static-assets binding. */
export async function readRuntimeFile(file: string): Promise<Buffer> {
  if (process.env.PRIORS_CLOUDFLARE === "1") {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const assets = getCloudflareContext().env.ASSETS;
    if (!assets) throw new Error("Missing Workers assets binding");
    const response = await assets.fetch(`https://assets.local/cdn-cgi/priors/${file}`);
    if (!response.ok) throw new Error(`Missing bundled file: ${file}`);
    return Buffer.from(await response.arrayBuffer());
  }
  if (file.startsWith("data/snapshots/")) return readFile(path.join(process.cwd(), "data/snapshots", file.slice("data/snapshots/".length)));
  if (file.startsWith("src/lib/og-fonts/")) return readFile(path.join(process.cwd(), "src/lib/og-fonts", file.slice("src/lib/og-fonts/".length)));
  if (file === "public/skill/SKILL.md") return readFile(path.join(process.cwd(), "public/skill/SKILL.md"));
  throw new Error(`Unsupported bundled file: ${file}`);
}

export async function bundledSnapshotDates(): Promise<string[]> {
  const files: string[] = process.env.PRIORS_CLOUDFLARE === "1"
    ? JSON.parse((await readRuntimeFile("data/snapshots/dates.json")).toString("utf8"))
    : await readdir(path.resolve(process.cwd(), "data/snapshots")).catch(() => [] as string[]);
  return files.map(f => f.match(/^(\d{4}-\d{2}-\d{2})\.json\.gz$/)?.[1]).filter((d): d is string => !!d).sort();
}
