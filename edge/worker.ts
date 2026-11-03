import { edgeCached } from "../src/lib/edge-cache";

/** The front of mypriors.com: answers from the edge when it can, and only then wakes the app Worker. */
export default {
  fetch(request: Request, env: { APP: { fetch(r: Request): Promise<Response> }; BUILD_ID?: string }, ctx: { waitUntil(work: Promise<unknown>): void }) {
    return edgeCached(request, (caches as unknown as { default: Cache }).default, (work) => ctx.waitUntil(work), () => env.APP.fetch(request.clone()), env.BUILD_ID ?? "dev");
  },
};
