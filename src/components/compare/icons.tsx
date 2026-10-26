const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

/** Two lists with a line crossing between them: the compare view. */
export function CompareIcon() {
  return <svg {...base}><path d="M4 6h5M4 12h5M4 18h5M15 6h5M15 12h5M15 18h5M9 6l6 12M9 18l6-12" /></svg>;
}

/** Sliders: open this mix in the builder. */
export function BuilderIcon() {
  return <svg {...base}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></svg>;
}
