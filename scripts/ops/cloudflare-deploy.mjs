import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cloudflareEnv } from "./cloudflare-env.mjs";

const file = process.env.PRIORS_ENV_FILE || ".env.cloudflare.production";
const app = cloudflareEnv(readFileSync(file, "utf8"));
const env = { ...process.env, ...app, PRIORS_CLOUDFLARE: "1", CLOUDFLARE_ACCOUNT_ID: "b38802397093b6d21eff2ac4c5159edd" };
delete env.VERCEL;
const lock = ".wrangler/priors-deploy.lock";
mkdirSync(".wrangler", { recursive: true });
try { mkdirSync(lock); } catch { throw new Error(`Another deploy holds ${lock}. Check that process before removing its lock.`); }
function run(command, args, input, runEnv = env) {
  const result = spawnSync(command, args, { env: runEnv, stdio: input ? ["pipe", "inherit", "inherit"] : "inherit", input });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args[0]} failed with status ${result.status}`);
}
try {
  // The checks read the checkout. Under PRIORS_CLOUDFLARE they would look for the Workers binding and fail.
  run("npm", ["run", "ci"], undefined, process.env);
  if (app.CONVEX_DEPLOY_KEY) run("npx", ["convex", "deploy", "--cmd", "npm run cf:build"]);
  else run("npm", ["run", "cf:build"]);
  const runtime = Object.fromEntries(Object.entries(app).filter(([key]) => !["CONVEX_DEPLOY_KEY", "NEXT_PUBLIC_SITE_URL"].includes(key)));
  run("npx", ["wrangler", "secret", "bulk"], JSON.stringify(runtime));
  run("npx", ["opennextjs-cloudflare", "deploy"]);
  // The front keys its cache by build, so a page from before this deploy never asks for chunks that are gone.
  const build = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim() + `-${Date.now()}`;
  run("npx", ["wrangler", "deploy", "--config", "edge/wrangler.jsonc", "--var", `BUILD_ID:${build}`]);
} finally {
  // Use Adam's reversible rm shim, including on a failed build or deploy.
  spawnSync("rm", ["-rf", lock], { stdio: "inherit" });
}
