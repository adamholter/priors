import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests import modules that use the app's `@/` alias. The shell and git tests start real processes: on a busy machine
// (the Mac runs scrapes and dev servers) they pass slowly, so they get a minute instead of vitest's 5 seconds.
// Tests read the checked-in snapshot, never the live one: on Vercel (`VERCEL` set) `loadSnapshot` would otherwise fetch
// whatever data-live holds that minute, so the deploy gate could fail on data that the local run never saw.
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { testTimeout: 60_000, env: { SNAPSHOT_BASE_URL: "" } } });
