import type { IndexConfig } from "@/engine";
import { PAGE_KEY, pageIndexId, pageRef, type FromPage } from "@/lib/url";

/** The signed-in visitor's published page: its handle and the mixes saved on it. */
export type PageMixes = { handle: string; indices: IndexConfig[] };

/** This tab's key for page references (see `FromPage`), made on first use so "Save to my page" updates the mix in place. */
export function tabPageKey(): string | null {
  try {
    let key = sessionStorage.getItem(PAGE_KEY);
    if (!key) { key = crypto.randomUUID().replace(/-/g, ""); sessionStorage.setItem(PAGE_KEY, key); }
    return key;
  } catch { return null; }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The open mix that is this page mix: opened from it in this tab, or else of the same name (the rule "Save to my page" uses). */
export function openCopyOf(open: FromPage[], page: PageMixes, mix: IndexConfig, key: string | null): FromPage | undefined {
  return open.find((i) => pageIndexId(i, page.handle, key) === mix.id) ?? open.find((i) => sameName(i.name, mix.name));
}

/** A page mix as an open mix: a fresh id when that one is taken, and a reference back to the page so saving updates it. */
export function openedFromPage(open: IndexConfig[], page: PageMixes, mix: IndexConfig, key: string | null): FromPage {
  const id = open.some((i) => i.id === mix.id) ? `i${Date.now().toString(36)}` : mix.id;
  return { ...structuredClone(mix), id, ...(key ? { page: pageRef(page.handle, mix.id, key) } : {}) };
}
