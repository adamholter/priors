/**
 * Serves the production build and runs the browser checks against it: smoke (every route, onboarding
 * end to end) and interactions (the builder's controls). CI runs this after `npm run build`.
 *   npm run build && npm run e2e
 */
import { spawn } from "node:child_process";

const PORT = process.env.E2E_PORT ?? "48740";
const BASE = `http://localhost:${PORT}`;
const server = spawn("npx", ["next", "start", "-p", PORT], { stdio: ["ignore", "inherit", "inherit"] });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

const run = (script) => new Promise((resolve) => {
  const child = spawn("node", [script], { stdio: "inherit", env: { ...process.env, BASE } });
  child.on("exit", (code) => resolve(code ?? 1));
});

let code = 1;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/privacy`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 59) throw new Error("server did not start");
  }
  const smoke = await run("scripts/verify/smoke.mjs");
  const interactions = await run("scripts/verify/interactions.mjs");
  code = smoke || interactions;
} finally {
  stop();
}
process.exit(code);
