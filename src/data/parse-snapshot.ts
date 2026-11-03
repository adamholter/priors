import { sharedStrings } from "./share-strings";

const QUOTE = 34, BACKSLASH = 92, OPEN_BRACE = 123, CLOSE_BRACE = 125, OPEN_BRACKET = 91, CLOSE_BRACKET = 93, COMMA = 44, COLON = 58;

/**
 * JSON.parse of a whole snapshot holds the 22 MB text, a copy per string and the objects at once, which is more than a
 * Workers isolate's 128 MB. This walks the bytes and parses one top-level array element at a time, sharing each
 * element's repeated strings straight away, so only a small slice of text is ever alive. The result equals JSON.parse.
 */
export function parseTopLevel<T>(bytes: Uint8Array): T {
  const text = new TextDecoder(), out: Record<string, unknown> = {}, share = sharedStrings();
  const slice = (a: number, b: number) => JSON.parse(text.decode(bytes.subarray(a, b)));
  const blank = (c: number) => c === 32 || c === 10 || c === 13 || c === 9;
  /** The index just past the value starting at `i`. */
  const skip = (i: number) => {
    let depth = 0, inString = false;
    for (; i < bytes.length; i++) {
      const c = bytes[i];
      if (inString) { if (c === BACKSLASH) i++; else if (c === QUOTE) { inString = false; if (depth === 0) return i + 1; } continue; }
      if (depth === 0 && (c === COMMA || c === CLOSE_BRACE || c === CLOSE_BRACKET || blank(c))) return i;
      if (c === QUOTE) inString = true;
      else if (c === OPEN_BRACE || c === OPEN_BRACKET) depth++;
      else if (c === CLOSE_BRACE || c === CLOSE_BRACKET) { depth--; if (depth === 0) return i + 1; }
    }
    return i;
  };
  let i = 0;
  const pass = () => { while (i < bytes.length && blank(bytes[i])) i++; };
  pass();
  if (bytes[i] !== OPEN_BRACE) return slice(0, bytes.length);
  i++;
  for (;;) {
    pass();
    if (bytes[i] === CLOSE_BRACE || i >= bytes.length) break;
    if (bytes[i] === COMMA) { i++; continue; }
    const keyEnd = skip(i), key = slice(i, keyEnd) as string;
    i = keyEnd; pass();
    if (bytes[i] !== COLON) throw new SyntaxError("Bad snapshot JSON");
    i++; pass();
    if (bytes[i] !== OPEN_BRACKET) { const end = skip(i); out[key] = slice(i, end); i = end; continue; }
    const list: unknown[] = [];
    i++;
    for (;;) {
      pass();
      if (bytes[i] === CLOSE_BRACKET) { i++; break; }
      if (bytes[i] === COMMA) { i++; continue; }
      if (i >= bytes.length) throw new SyntaxError("Bad snapshot JSON");
      const end = skip(i);
      list.push(share(slice(i, end)));
      i = end;
    }
    out[key] = list;
  }
  return out as T;
}
