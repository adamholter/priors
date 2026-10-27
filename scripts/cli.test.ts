import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cli = path.resolve(__dirname, "../public/cli/priors.mjs");

describe("priors CLI", () => {
  it("prints its version and help without touching the network", () => {
    const v = readFileSync(cli, "utf8").match(/const VERSION = "([^"]+)"/)![1];
    expect(execFileSync("node", [cli, "--version"]).toString().trim()).toBe(v);
    expect(execFileSync("node", [cli, "help"]).toString()).toContain("priors rank");
  });
  it("ships a tarball that matches the file (run `node scripts/build-cli.mjs` after editing the CLI)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "priors-tgz-"));
    execFileSync("tar", ["-xzf", path.resolve(__dirname, "../public/cli/priors-cli.tgz"), "-C", dir]);
    expect(readFileSync(path.join(dir, "package/priors.mjs"), "utf8")).toBe(readFileSync(cli, "utf8"));
    const pkg = JSON.parse(readFileSync(path.join(dir, "package/package.json"), "utf8"));
    expect(pkg.bin.priors).toBe("./priors.mjs");
    expect(pkg.version).toBe(readFileSync(cli, "utf8").match(/const VERSION = "([^"]+)"/)![1]);
  });
  it("answers MCP over stdio by forwarding to the server it is pointed at", () => {
    // An unreachable server still yields a well-formed JSON-RPC error for a request.
    const out = execFileSync("node", [cli, "mcp"], { input: '{"jsonrpc":"2.0","id":7,"method":"ping"}\n', env: { ...process.env, PRIORS_URL: "http://127.0.0.1:9" } }).toString();
    expect(JSON.parse(out)).toMatchObject({ id: 7, error: { code: -32000 } });
  });
});
