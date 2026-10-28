/** Pure pieces of the short-link table, shared by `shortLinks.ts` and the tests. No Convex imports. */
export const MAX_PATH_BYTES = 32 * 1024;
export const SLUG_LENGTH = 7;
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** Same-origin path only: starts with one `/`, no scheme-relative `//` or `/\`, no control characters, under 32 KB. */
export function validPath(path: string): boolean {
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return false;
  return new TextEncoder().encode(path).length <= MAX_PATH_BYTES;
}

export const validSlug = (slug: string) => /^[0-9A-Za-z]{7}$/.test(slug);

/** Seven random base62 characters. Rejection sampling keeps every character equally likely. */
export function randomSlug(bytes: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  while (out.length < SLUG_LENGTH) for (const b of bytes(16)) if (b < 248 && out.length < SLUG_LENGTH) out += ALPHABET[b % 62];
  return out;
}

/** Index key for a path: indexes cap key size, so long paths are looked up by their SHA-256. */
export async function pathHash(path: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
