import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cloudflareEnv } from "./cloudflare-env.mjs";

const app = cloudflareEnv(readFileSync(process.env.PRIORS_ENV_FILE || ".env.cloudflare.production", "utf8"));
delete app.CONVEX_DEPLOY_KEY;
const file = ".wrangler/priors-runtime.env";
mkdirSync(".wrangler", { recursive: true });
writeFileSync(file, Object.entries(app).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n"), { mode: 0o600 });
try {
  const result = spawnSync("npx", ["wrangler", "dev", "--port", "48742", "--env-file", file], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  spawnSync("rm", ["-f", file], { stdio: "inherit" });
}
