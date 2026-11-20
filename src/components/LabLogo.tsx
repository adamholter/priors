"use client";
import { useLabColor } from "./chart/echarts";

/** Labs with a logo file in public/logos (the file's name where it differs from the lab id). */
export const LAB_LOGO: Record<string, string> = { anthropic: "anthropic", openai: "openai", google: "google", xai: "xai", cursor: "cursor", moonshot: "kimi", zhipu: "zhipu", minimax: "minimax", xiaomi: "xiaomi", tencent: "tencent", alibaba: "alibaba", mistral: "mistral", cognition: "devin" };

/** A lab's logo, or its initial on the lab's chart color where there is no logo file. */
export function LabLogo({ lab, name, color, size = 18 }: { lab: string; name: string; color?: string; size?: number }) {
  const labColor = useLabColor();
  if (LAB_LOGO[lab]) return <img src={`/logos/${LAB_LOGO[lab]}.png`} alt="" width={size} height={size} loading="lazy" className="lab-logo" style={{ width: size, height: size }} />;
  return <span aria-hidden="true" className="lab-logo lab-letter" style={{ width: size, height: size, fontSize: Math.round(size * 0.55), background: labColor(lab, color) }}>{name.slice(0, 1).toUpperCase()}</span>;
}
