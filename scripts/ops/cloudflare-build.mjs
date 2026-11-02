import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cloudflareEnv } from "./cloudflare-env.mjs";

const app = cloudflareEnv(readFileSync(process.env.PRIORS_ENV_FILE || ".env.cloudflare.production", "utf8"));
const env = { ...process.env, ...app, PRIORS_CLOUDFLARE: "1" };
delete env.VERCEL;
for (const args of [["opennextjs-cloudflare", "build"], ["node", "scripts/ops/cloudflare-assets.mjs"]]) {
  const result = args[0] === "node"
    ? spawnSync(process.execPath, args.slice(1), { env, stdio: "inherit" })
    : spawnSync("npx", args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
