import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

/**
 * POST /upload?field=avatar|banner, with the signed-in user's Convex token as a bearer token and the
 * image as the body. This is the only way an image reaches a page. The server reads the file, checks
 * it and stores it itself, so no file id ever comes from a browser and a stored file always has a
 * known owner. Nothing is stored until every check has passed.
 */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const BAD_IMAGE = "Use a PNG, JPEG, WebP, GIF or AVIF image";
// The token travels in a header, never a cookie, so another site's page has nothing to ride on and any origin may call.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Max-Age": "86400" };
const reply = (status: number, body: { ok: true } | { error: string }) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });

/**
 * What a file is, from its first bytes: raster formats only. This decides the type the image is
 * stored and served with; the type the browser declared is never used. SVG is out because it is a
 * document that can carry script.
 */
export function sniffImage(b: Uint8Array): string | undefined {
  const at = (from: number, text: string) => [...text].every((c, i) => b[from + i] === c.charCodeAt(0));
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (at(0, "GIF87a") || at(0, "GIF89a")) return "image/gif";
  if (at(0, "RIFF") && at(8, "WEBP")) return "image/webp";
  if (at(4, "ftyp") && (at(8, "avif") || at(8, "avis"))) return "image/avif";
  return undefined;
}

const upload = httpAction(async (ctx, request) => {
  const field = new URL(request.url).searchParams.get("field");
  if (field !== "avatar" && field !== "banner") return reply(400, { error: "field must be avatar or banner" });
  // A token that does not parse makes this throw rather than return nothing: either way, not signed in.
  if (!(await ctx.auth.getUserIdentity().catch(() => null))) return reply(401, { error: "Sign in first" });
  // Cheapest first: the stated size, then the account's daily count, and only then the body.
  const stated = Number(request.headers.get("content-length"));
  if (stated > MAX_IMAGE_BYTES) return reply(413, { error: "That image is over 8 MB" });
  try {
    await ctx.runMutation(internal.profiles.reserveUpload, {});
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) return reply(413, { error: "That image is over 8 MB" });
    const type = sniffImage(bytes);
    if (!type) return reply(415, { error: BAD_IMAGE });
    const storageId = await ctx.storage.store(new Blob([bytes], { type }));
    // If the page cannot take it after all, the file this request just stored goes again.
    try { await ctx.runMutation(internal.profiles.setImage, { field, storageId }); }
    catch (e) { await ctx.storage.delete(storageId); throw e; }
    return reply(200, { ok: true });
  } catch (e) {
    if (e instanceof ConvexError && typeof e.data === "string") return reply(/Too many/.test(e.data) ? 429 : 403, { error: e.data });
    console.error("upload failed", e);
    return reply(500, { error: "Couldn’t upload that image. Try again." });
  }
});

const http = httpRouter();
http.route({ path: "/upload", method: "POST", handler: upload });
http.route({ path: "/upload", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })) });
export default http;
