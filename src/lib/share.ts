import { withoutPristineDefault } from "./default-index";
import type { IndexConfig } from "@/engine";
import { encodeIndices } from "./url";

export async function copyCardImage(imageUrl: string): Promise<string> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return "Use Download card to save the image.";
  const card = fetch(imageUrl).then((r) => {
    if (!r.ok || !r.headers.get("content-type")?.includes("image/png")) throw new Error("Card could not load.");
    return r.blob();
  });
  void card.catch(() => {});
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": card })]);
    return "Card copied.";
  } catch { return "Couldn't copy the image. Use Download card."; }
}

/** Post text that carries the result itself: a surprising #1 gets replies, "My priors on Priors" doesn't. */
export function shareText(top: string[], owner?: string, note?: string) {
  const names = [...new Set(top)].slice(0, 3);
  if (!names.length) return owner ? `${owner}'s AI model ranking on Priors` : "My AI model ranking on Priors";
  const head = owner ? `${owner}'s AI model ranking:` : "My AI model ranking:";
  return `${head}\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}\n\n${note ? `${note} ` : ""}What are your priors?`;
}

/**
 * Posts a share card to X. Phones get the native share sheet with the PNG attached; desktops get the
 * X draft plus the image on the clipboard (X web intents can't attach images). Resolves to a status
 * message for the UI, or "" when nothing needs saying.
 */
export async function shareCardToX({ imageUrl, text, url, fileName = "priors.png" }: { imageUrl: string; text: string; url?: string; fileName?: string }): Promise<string> {
  const params = new URLSearchParams({ text });
  if (url && !/^https?:\/\/(localhost|127\.|\[::1\])/.test(url)) params.set("url", url);
  const intent = `https://x.com/intent/post?${params}`;
  const fetchCard = () => fetch(imageUrl).then((r) => {
    if (!r.ok || !r.headers.get("content-type")?.includes("image/png")) throw new Error("Card could not load.");
    return r.blob();
  });
  if (window.matchMedia("(pointer: coarse)").matches) {
    try {
      const file = new File([await fetchCard()], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: url ? `${text}\n${url}` : text }).catch((e) => { if ((e as Error).name !== "AbortError") throw e; });
        return "";
      }
      window.open(intent, "_blank", "noopener");
      return "This device can't attach the card. Use Download and add it to the draft.";
    } catch {
      return "Couldn't share the card. Use Download and attach it.";
    }
  }
  window.open(intent, "_blank", "noopener");
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return "Couldn't copy the image. Use Download and attach it.";
  const paste = /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘V" : "Ctrl+V";
  const card = fetchCard();
  void card.catch(() => {});
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": card })]);
    return `Card copied. Press ${paste} in the X draft to attach it.`;
  } catch { return "Couldn't copy the image. Use Download and attach it."; }
}

/** Remembers the page to come back to after sign-in. localStorage, not sessionStorage: OAuth leaves the origin and drops session state. */
export function stashReturn() {
  try { localStorage.setItem("priors:return", window.location.pathname + window.location.search); } catch { /* private mode */ }
}

/** Saves the indices to publish, and the page to return to, across the sign-in hop. */
export function stashForPublish(indices: IndexConfig[]) {
  try { localStorage.setItem("priors:pending", encodeIndices(withoutPristineDefault(indices)).toString()); } catch { /* private mode */ }
  stashReturn();
}

/** A published page the visitor came from, so their result can be compared with it. */
export type Via = { handle: string; name: string; top: string[]; /** Their full ranking as model ids, for the solver-weighted similarity. */ ids?: string[] };
export const VIA_KEY = "priors:via";
export function readVia(): Via | null {
  try { const v = JSON.parse(localStorage.getItem(VIA_KEY) ?? "null") as Via | null; return v?.handle && Array.isArray(v.top) ? v : null; } catch { return null; }
}
