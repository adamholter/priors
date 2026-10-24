/** Place selected labels in priority order, trying both sides before hiding a crowded label.
 * Labels keep clear of each other and, where a slot allows, of the other marks (`dots`: the marks' pixel
 * positions, when the chart can supply them). `fontPx` is each label's font size: ECharts hands over the label box at the
 * size it had before a size change, so the box is scaled up to the configured size. `placed` hears where each label landed (null when hidden), so a leader line can join it to its dot. Self-contained so standalone HTML exports can use the same function. */
export function scatterLabelLayout(width: () => number | undefined, height: () => number | undefined, visible: boolean[], dots?: () => ({ x: number; y: number }[] | undefined), fontPx?: number[], placed?: (index: number, at: { x: number; y: number; align: "left" | "right" } | null) => void) {
  let visited = new Set<number>();
  let occupied: { x: number; y: number; width: number; height: number }[] = [];
  return (p: { dataIndex?: number; rect: { x: number; y: number; width: number; height: number }; labelRect: { x: number; y: number; width: number; height: number } }): { hideOverlap: boolean; x?: number; y?: number; align?: "left" | "right"; verticalAlign?: "middle" } => {
    const index = p.dataIndex ?? -1;
    // ECharts may reuse marks in their old traversal order after data changes.
    // A repeated index starts a new pass; a smaller, unseen index does not.
    if (visited.has(index)) { occupied = []; visited = new Set(); }
    visited.add(index);
    const w = width(), h = height(), r = p.labelRect;
    const fallback: { hideOverlap: boolean; x?: number; align?: "right" } = { hideOverlap: true };
    if (w && r.x + r.width > w - 4) { fallback.x = p.rect.x - 7; fallback.align = "right"; }
    if (!visible[index]) { placed?.(index, null); return fallback; }
    // The label box can be stale: after the label size is raised ECharts still reports the old, smaller box (a 150% label
    // came through at 100%). Scale it up to the configured font size, which is known. The canvas also measures text with a
    // fallback font that is a few percent narrower than the web font, so the reserve is a little wider than the text.
    const want = (fontPx?.[index] ?? 0) * 1.13, grow = want > r.height ? want / r.height : 1;
    const tw = r.width * grow * 1.08, th = Math.max(r.height, want);
    const reserve = tw + 12, tall = th + 8;
    const own = { x: p.rect.x + p.rect.width / 2, y: p.rect.y + p.rect.height / 2 };
    // Other marks, not this one (it sits within a few pixels of its own center).
    const others = (dots?.() ?? []).filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y) && Math.hypot(d.x - own.x, d.y - own.y) > 4);
    const step = Math.max(12, tall / 2);
    const maxSteps = h ? Math.ceil(h / step) : 20;
    const offsets = Array.from({ length: maxSteps * 2 + 1 }, (_, i) => i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? -1 : 1) * step);
    for (const clear of [true, false]) for (const dy of offsets) for (const right of [true, false]) {
      const x = right ? p.rect.x + p.rect.width + 7 : p.rect.x - 7;
      const y = p.rect.y + p.rect.height / 2 + dy;
      const box = { x: right ? x - 6 : x - tw - 6, y: y - tall / 2, width: reserve, height: tall };
      if (box.x < 4 || (w && box.x + box.width > w - 4) || box.y < 24 || (h && box.y + box.height > h - 40)) continue;
      if (occupied.some(b => box.x < b.x + b.width + 3 && box.x + box.width + 3 > b.x && box.y < b.y + b.height + 3 && box.y + box.height + 3 > b.y)) continue;
      if (clear && others.some((d) => d.x + 5 > box.x && d.x - 5 < box.x + box.width && d.y + 5 > box.y && d.y - 5 < box.y + box.height)) continue;
      occupied.push(box);
      placed?.(index, { x, y, align: right ? "left" : "right" });
      return { x, y, align: right ? "left" : "right", verticalAlign: "middle", hideOverlap: false };
    }
    // No nearby slot fits. Keep this label outside the clipped canvas, rather than letting the
    // renderer's mark-size heuristic hide a higher-priority label that already has a safe slot.
    placed?.(index, null);
    return { x: -10000, y: -10000, hideOverlap: true };
  };
}
