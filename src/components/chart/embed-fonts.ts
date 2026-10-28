/**
 * An exported SVG is drawn as an image, which cannot see the page's web fonts: without this a theme's
 * font (Excalifont, Newsreader) falls back to a system font (Comic Sans, Georgia) in the PNG. This
 * finds the families the SVG names, takes the page's own @font-face files for them (Latin subsets),
 * and inlines them as data URLs in a <style>, under the exact names the SVG uses.
 */
const key = (family: string) => family.replace(/["']/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dataUrls = new Map<string, Promise<string | null>>();

function dataUrl(url: string): Promise<string | null> {
  let p = dataUrls.get(url);
  if (!p) {
    p = fetch(url).then((r) => (r.ok ? r.blob() : null)).then((b) => b && new Promise<string>((resolve, reject) => {
      const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = () => reject(fr.error); fr.readAsDataURL(b);
    })).catch(() => null);
    dataUrls.set(url, p);
  }
  return p;
}

/** Families named in the SVG's font-family attributes, style properties and `font` shorthands. */
export function svgFamilies(svg: string): string[] {
  const out = new Set<string>();
  for (const m of svg.replace(/&quot;|&apos;|&#39;/g, "'").matchAll(/font-family(?:="([^"]+)"|:\s*([^;"]+))|[\s;"]font:\s*([^;"]+)/g)) {
    // The shorthand starts with style, weight and size ("bold 12px"); families follow the size.
    const list = m[1] ?? m[2] ?? (m[3] ?? "").replace(/^.*?\d[\d.]*(?:px|pt|em|rem)(?:\/\S+)?\s+/, "");
    for (const f of list.split(",")) { const name = f.trim().replace(/^["']|["']$/g, ""); if (name) out.add(name); }
  }
  return [...out];
}

const LATIN = /U\+0+-0*FF\b|U\+0+-/i;

export async function embedFonts(svg: string): Promise<string> {
  if (typeof document === "undefined") return svg;
  const wanted = new Map(svgFamilies(svg).map((n) => [key(n), n]));
  const faces: { name: string; rule: CSSFontFaceRule; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList; try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const name = wanted.get(key(rule.style.getPropertyValue("font-family")));
      const range = rule.style.getPropertyValue("unicode-range");
      if (name && (!range || LATIN.test(range))) faces.push({ name, rule, base: sheet.href ?? location.href });
    }
  }
  const css = (await Promise.all(faces.map(async ({ name, rule, base }) => {
    const src = rule.style.getPropertyValue("src").match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!src) return "";
    const url = await dataUrl(new URL(src, base).href);
    if (!url) return "";
    const weight = rule.style.getPropertyValue("font-weight") || "400", style = rule.style.getPropertyValue("font-style") || "normal";
    return `@font-face{font-family:"${name}";src:url(${url});font-weight:${weight};font-style:${style}}`;
  }))).join("");
  if (!css) return svg;
  return svg.replace(/<svg\b[^>]*>/, (open) => `${open}<defs><style>${css}</style></defs>`);
}
