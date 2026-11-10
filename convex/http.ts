import { httpRouter } from "convex/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { cleanFileName, FILE_KINDS, isText, MAX_FILE_BYTES, sniffFile, uploaderKey } from "./requestRules";

/**
 * POST /upload?field=avatar|banner, with the signed-in user's Convex token as a bearer token and the
 * image as the body. This is the only way an image reaches a page. The server reads the file, checks
 * it and stores it itself, so no file id ever comes from a browser and a stored file always has a
 * known owner. Nothing is stored until every check has passed, and the body is read under its limits.
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

/**
 * Reads an upload a chunk at a time, so the limits hold while the body arrives rather than after it
 * has all been buffered: it stops at the first chunk that takes the body past the size limit, and as
 * soon as the opening bytes turn out not to be an image. The stated content-length is only a hint; a
 * body can arrive without one, or with a wrong one.
 */
async function readImage(request: Request): Promise<{ bytes: Uint8Array<ArrayBuffer>; type: string } | { status: number; error: string }> {
  const reader = request.body?.getReader();
  if (!reader) return { status: 415, error: BAD_IMAGE };
  const chunks: Uint8Array[] = [];
  let size = 0, type: string | undefined;
  const stop = async (status: number, error: string) => { await reader.cancel().catch(() => {}); return { status, error }; };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_IMAGE_BYTES) return stop(413, "That image is over 8 MB");
    chunks.push(value);
    if (!type && size >= 16) {
      const head = new Uint8Array(16);
      for (let at = 0, n = 0; at < 16; n++) { head.set(chunks[n].subarray(0, 16 - at), at); at += chunks[n].length; }
      type = sniffImage(head);
      if (!type) return stop(415, BAD_IMAGE);
    }
  }
  if (!type) return { status: 415, error: BAD_IMAGE };
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
  return { bytes, type };
}

const upload = httpAction(async (ctx, request) => {
  const field = new URL(request.url).searchParams.get("field");
  if (field !== "avatar" && field !== "banner") return reply(400, { error: "field must be avatar or banner" });
  // A token that does not parse makes this throw rather than return nothing: either way, not signed in.
  if (!(await ctx.auth.getUserIdentity().catch(() => null))) return reply(401, { error: "Sign in first" });
  // Cheapest first: the stated size, then the account's daily count, and only then the body, read under its own limit.
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) return reply(413, { error: "That image is over 8 MB" });
  try {
    await ctx.runMutation(internal.profiles.reserveUpload, {});
    const image = await readImage(request);
    if ("error" in image) return reply(image.status, { error: image.error });
    const storageId = await ctx.storage.store(new Blob([image.bytes], { type: image.type }));
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

/**
 * POST /request-file?name=<file name>&client=<the browser's request id>, with the file as the body: a file to go with a
 * report from `/request`. Anyone may call it, as anyone may send a report, so everything is checked here: how many files
 * this sender (by address when there is one) and everyone have uploaded lately and how many bytes, the size as the body arrives, and what the file is from its own bytes
 * (a picture, a PDF, a video, or readable text). The answer is the id the form then sends with the report. A file whose
 * report never comes is deleted a day later (crons.ts).
 */
const FILE_TOO_BIG = `That file is over ${MAX_FILE_BYTES / 1024 / 1024} MB`;
const fileReply = (status: number, body: { ok: true; id: string } | { error: string }) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json", "cache-control": "no-store" } });
/** An address is only needed to tell one uploader from another, so it is stored scrambled, never as it came. */
async function scrambled(key: string): Promise<string> {
  if (!key.startsWith("ip:")) return key;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${process.env.REQUESTS_TOKEN ?? "priors"}:${key}`));
  return `ip:${[...new Uint8Array(digest)].slice(0, 10).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}
const requestFile = httpAction(async (ctx, request) => {
  const q = new URL(request.url).searchParams;
  const name = cleanFileName(q.get("name") ?? ""), client = await scrambled(uploaderKey(request.headers.get("x-forwarded-for"), q.get("client")));
  const stated = Number(request.headers.get("content-length"));
  if (stated > MAX_FILE_BYTES) return fileReply(413, { error: FILE_TOO_BIG });
  let id: Id<"requestFiles"> | undefined, kept = false;
  try {
    // The place is taken before a byte is read, so uploads arriving together are all counted.
    id = await ctx.runMutation(internal.requests.reserveFile, { client, size: stated > 0 ? stated : MAX_FILE_BYTES });
    const reader = request.body?.getReader();
    if (!reader) return fileReply(400, { error: "No file came with that" });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES) { await reader.cancel().catch(() => {}); return fileReply(413, { error: FILE_TOO_BIG }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; }
    const type = sniffFile(bytes.subarray(0, 16)) ?? (isText(bytes) ? "text/plain" : undefined);
    if (!type) return fileReply(415, { error: `Attach ${FILE_KINDS}` });
    const storageId = await ctx.storage.store(new Blob([bytes], { type }));
    try { await ctx.runMutation(internal.requests.fillFile, { id, storageId, name, type, size }); }
    catch (e) { await ctx.storage.delete(storageId); throw e; }
    kept = true;
    return fileReply(200, { ok: true, id });
  } catch (e) {
    if (e instanceof ConvexError && typeof e.data === "string") return fileReply(429, { error: e.data });
    console.error("request file failed", e);
    return fileReply(500, { error: "Could not upload that file. Try again." });
  } finally {
    // Whatever stopped it, a place that holds no file is given back.
    if (id && !kept) await ctx.runMutation(internal.requests.dropFile, { id }).catch(() => {});
  }
});

const http = httpRouter();
http.route({ path: "/upload", method: "POST", handler: upload });
http.route({ path: "/upload", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })) });
http.route({ path: "/request-file", method: "POST", handler: requestFile });
http.route({ path: "/request-file", method: "OPTIONS", handler: httpAction(async () => new Response(null, { status: 204, headers: CORS })) });
export default http;
