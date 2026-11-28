"use client";
import { useChartPalette, useLabColor } from "./chart/echarts";
import { labLogo } from "@/data/lab-logos";

/** The grey every lab without a chart color of its own was given: it says "no color", so it gets a plain tile, not a grey one. */
const NO_COLOR = "#A3A39B";
const luminance = (hex: string) => { const m = hex.replace("#", "").match(/.{2}/g); if (!m || m.length < 3) return 1; const [r, g, b] = m.slice(0, 3).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/**
 * A lab's logo (`public/logos`, listed in `src/data/lab-logos.ts`), or where it has none its initial: on the lab's chart
 * color when it has one, else on a plain hairline tile. On a dark page a dark mark flips light (`.lab-logo-flip`).
 */
export function LabLogo({ lab, name, color, size = 18 }: { lab: string; name: string; color?: string; size?: number }) {
  const pal = useChartPalette(), labColor = useLabColor();
  const logo = labLogo(lab);
  // eslint-disable-next-line @next/next/no-img-element
  if (logo?.file) return <img src={`/logos/${logo.file}`} alt="" width={size} height={size} loading="lazy" decoding="async" className={`lab-logo${logo.dark ? ` lab-logo-${logo.dark}` : ""}${pal.dark ? " is-dark" : ""}`} style={{ width: size, height: size }} />;
  const own = lab !== "other" && !!color && color.toUpperCase() !== NO_COLOR, fill = own ? labColor(lab, color) : undefined;
  const initial = lab === "other" ? "?" : (logo?.name ?? name).slice(0, 1).toUpperCase();
  return <span aria-hidden="true" className={`lab-logo lab-letter${fill ? "" : " lab-letter-plain"}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.55), ...(fill ? { background: fill, color: luminance(fill) > 0.4 ? "#1A1A1A" : "#FFFFFF" } : {}) }}>{initial}</span>;
}
