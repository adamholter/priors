// Packs public/cli/priors.mjs into public/cli/priors-cli.tgz so `npm i -g https://mypriors.com/cli/priors-cli.tgz` works.
// Run after editing the CLI: node scripts/build-cli.mjs (a test fails when the tarball is stale).
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const src = new URL("../public/cli/", import.meta.url).pathname;
const version = readFileSync(join(src, "priors.mjs"), "utf8").match(/const VERSION = "([^"]+)"/)[1];
const tmp = mkdtempSync(join(tmpdir(), "priors-cli-")), pkg = join(tmp, "package");
mkdirSync(pkg);
cpSync(join(src, "priors.mjs"), join(pkg, "priors.mjs"));
writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "priors-cli", version, description: "Priors CLI and MCP server: rank AI models with benchmark indexes", type: "module", bin: { priors: "./priors.mjs" }, engines: { node: ">=18" }, homepage: "https://mypriors.com/cli", license: "MIT" }, null, 2));
writeFileSync(join(pkg, "README.md"), "# priors-cli\n\nCLI and MCP server for https://mypriors.com. Docs: https://mypriors.com/cli\n");
execFileSync("tar", ["-czf", join(src, "priors-cli.tgz"), "-C", tmp, "package"]);
rmSync(tmp, { recursive: true });
console.log(`packed priors-cli ${version}`);
