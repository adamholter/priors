import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests import modules that use the app's `@/` alias.
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } } });
