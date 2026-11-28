import "./chart-key.css";

/** A frontier sketch on hairline axes: what a chart that is still loading, or has nothing to show, will be. No number on it. */
export function PlotSketch({ still }: { still?: boolean }) {
  return <svg aria-hidden="true" className="chart-sketch" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" data-fill={still || undefined} data-still={still || undefined}>
    {[0.12, 0.34, 0.56, 0.78].map((t) => <line key={t} x1="0" x2="100" y1={t * 100} y2={t * 100} stroke="var(--hair)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
    <line x1="0" x2="100" y1="96" y2="96" stroke="var(--hair-3)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    <path d="M4 90 C 20 78, 28 66, 40 48 S 62 24, 82 14 L 96 11" fill="none" stroke="var(--hair-3)" strokeWidth="1.4" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
  </svg>;
}

/** The cost chart's place on the page while the dataset loads: a title bar, the toolbar's buttons, a sketch of the frontier on axes. The title is a bar, not words, so it is right whatever the chart is called. */
export function ChartSkeleton() {
  return <div className="w-full h-[620px] max-lg:hidden" aria-hidden="true">
    <div className="flex items-center justify-between min-h-8 mb-1"><span className="chart-skeleton-title load-bar" /><span className="flex gap-1">{[0, 1, 2, 3, 4].map((i) => <i key={i} className="chart-skeleton-btn" />)}</span></div>
    <div className="chart-skeleton-plot"><PlotSketch /></div>
    <div className="mt-1 min-h-5" />
  </div>;
}
