import handler from "./.open-next/worker.js";
import { edgeCached } from "./src/lib/edge-cache";

export default {
  fetch(request: Request, env: unknown, ctx: { waitUntil(work: Promise<unknown>): void }) {
    return edgeCached(request, (caches as unknown as { default: Cache }).default, (work) => ctx.waitUntil(work), () => handler.fetch(request, env, ctx));
  },
};
