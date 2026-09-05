/**
 * Helpers for Next.js React Server Component (RSC) flight payloads inlined in HTML as
 * `self.__next_f.push([1,"..."])`. Shared by several sources; not a Source itself.
 */

/** Concatenate and JSON-unescape all `self.__next_f.push([1,"..."])` chunks. */
export function rscText(html: string): string {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) chunks.push(m[1]);
  const joined = chunks.join("");
  try { return JSON.parse(`"${joined}"`); } catch { /* fall through */ }
  // Chunk-wise decode as a fallback if the joined string is not a valid JSON string literal.
  return chunks.map((c) => { try { return JSON.parse(`"${c}"`); } catch { return c; } }).join("");
}

/** Return the balanced `{...}` or `[...]` JSON text starting at index `start`. */
export function balancedJson(text: string, start: number): string | undefined {
  const open = text[start];
  if (open !== "{" && open !== "[") return undefined;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return undefined;
}

/** Find `"key":` followed by an object/array and parse it. Returns all occurrences. */
export function extractKeyed<T = unknown>(text: string, key: string): T[] {
  const out: T[] = [];
  const needle = `"${key}":`;
  let idx = text.indexOf(needle);
  while (idx >= 0) {
    const start = idx + needle.length;
    const body = balancedJson(text, start);
    if (body) { try { out.push(JSON.parse(body) as T); } catch { /* skip */ } }
    idx = text.indexOf(needle, start + 1);
  }
  return out;
}
