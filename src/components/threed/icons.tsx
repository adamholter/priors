import type { ReactNode } from "react";

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const Svg = ({ children, size = 18 }: { children: ReactNode; size?: number }) => <svg {...base} width={size} height={size}>{children}</svg>;

/** One glyph per measure the chart can plot. */
export function MeasureIcon({ name, size }: { name: string; size?: number }) {
  switch (name) {
    case "score": return <Svg size={size}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /></Svg>;
    case "cost": return <Svg size={size}><circle cx="12" cy="12" r="8.5" /><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.7-1.4-1.5 0-2.6.8-2.6 2 0 3 5.4 1.4 5.4 4.4 0 1.2-1.1 2-2.8 2-1.3 0-2.4-.6-2.9-1.6M12 6.2v1.6M12 16.4v1.4" /></Svg>;
    case "time": return <Svg size={size}><circle cx="12" cy="12.5" r="7.5" /><path d="M12 8.5v4l2.6 1.6M9.5 3.5h5" /></Svg>;
    case "speed": return <Svg size={size}><path d="M4.5 17a8.5 8.5 0 1 1 15 0" /><path d="m12 13 3.8-4.2" /><circle cx="12" cy="13.2" r="1" fill="currentColor" /></Svg>;
    case "latency": return <Svg size={size}><path d="M13 3 6 13.5h5.2L10.5 21 18 10.2h-5.4z" /></Svg>;
    case "tokens": return <Svg size={size}><path d="M5 7h14M5 12h14M5 17h9" /></Svg>;
    case "uptime": return <Svg size={size}><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></Svg>;
    case "usage": return <Svg size={size}><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.5-3 2.7-5 5.5-5s5 2 5.5 5M16 6.5a3 3 0 0 1 0 5.8M17.5 14.2c1.8.7 3 2.4 3.3 4.8" /></Svg>;
    case "age": return <Svg size={size}><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></Svg>;
    default: return <Svg size={size}><circle cx="12" cy="12" r="7" /></Svg>;
  }
}

/** A little axis triad with one arm drawn heavy: which of the three directions an axis runs along. */
export function AxisIcon({ axis, size }: { axis: 0 | 1 | 2; size?: number }) {
  const arm = (d: string, on: boolean) => <path d={d} strokeWidth={on ? 2.2 : 1.1} opacity={on ? 1 : 0.4} />;
  return <Svg size={size}>{arm("M5 18h14", axis === 0)}{arm("M5 18V5", axis === 1)}{arm("M5 18l7-7", axis === 2)}<path d={axis === 0 ? "m16.5 15.5 2.5 2.5-2.5 2.5" : axis === 1 ? "m2.5 8 2.5-2.5L7.5 8" : "m9.5 10.8 2.7.2-.2-2.7"} /></Svg>;
}

export const CAMERA_ICONS: Record<string, ReactNode> = {
  perspective: <Svg><path d="M12 3.5 19.5 7v10L12 20.5 4.5 17V7z" /><path d="M12 3.5v8.5m0 0 7.5-5M12 12 4.5 7M12 12v8.5" opacity=".55" /></Svg>,
  isometric: <Svg><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" /></Svg>,
  front: <Svg><rect x="5" y="5" width="14" height="14" rx="1.5" /><path d="M5 12h14M12 5v14" opacity=".45" /></Svg>,
  side: <Svg><rect x="5" y="5" width="14" height="14" rx="1.5" /><path d="m9 12 3-3m-3 3 3 3M9 12h7" /></Svg>,
  top: <Svg><rect x="5" y="5" width="14" height="14" rx="1.5" /><path d="M5 9.5h14M5 14.5h14M9.5 5v14M14.5 5v14" opacity=".45" /></Svg>,
};

export const TOGGLE_ICONS = {
  labels: <Svg><path d="M4 7h10M4 12h16M4 17h8" /></Svg>,
  drops: <Svg><circle cx="12" cy="6" r="2" fill="currentColor" /><path d="M12 8.5V17" /><ellipse cx="12" cy="19" rx="4" ry="1.4" /></Svg>,
  glow: <Svg><circle cx="12" cy="12" r="3" fill="currentColor" /><circle cx="12" cy="12" r="6.5" opacity=".6" /><circle cx="12" cy="12" r="9.5" opacity=".3" /></Svg>,
  spin: <Svg><path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4.5h-4.5" /></Svg>,
  reset: <Svg><path d="M4 12a8 8 0 0 1 13.6-5.7M18 4v4h-4M20 12a8 8 0 0 1-13.6 5.7M6 20v-4h4" /></Svg>,
  rotate: <Svg><path d="M7 7h9l-2.5-2.5M17 17H8l2.5 2.5M16 7l-2.5 2.5M8 17l2.5-2.5" /></Svg>,
  chevron: <Svg size={14}><path d="m6 9 6 6 6-6" /></Svg>,
} as const;
