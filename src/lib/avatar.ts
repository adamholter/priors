/** Clerk's image host resizes on request; a sign-in photo is otherwise sent at full size for a small circle. Twice the shown size, for sharp screens. Stored uploads are shrunk when uploaded. */
export function avatarSrc(url: string, shownPx: number): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "img.clerk.com") return url;
    u.searchParams.set("width", String(shownPx * 2));
    u.searchParams.set("height", String(shownPx * 2));
    u.searchParams.set("fit", "crop");
    return u.toString();
  } catch { return url; }
}

/** The size to shrink a photo to: it fits inside `max` and keeps its shape, and a smaller photo stays as it is. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
