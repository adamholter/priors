/** Place selected labels in priority order, trying both sides before hiding a crowded label.
 * Self-contained so standalone HTML exports can use the same function. */
export function scatterLabelLayout(width: () => number | undefined, height: () => number | undefined, visible: boolean[]) {
  let lastIndex = -1;
  let occupied: { x: number; y: number; width: number; height: number }[] = [];
  return (p: { dataIndex?: number; rect: { x: number; y: number; width: number; height: number }; labelRect: { x: number; y: number; width: number; height: number } }): { hideOverlap: boolean; x?: number; y?: number; align?: "left" | "right"; verticalAlign?: "middle" } => {
    const index = p.dataIndex ?? -1;
    if (index <= lastIndex) occupied = [];
    lastIndex = index;
    const w = width(), h = height(), r = p.labelRect;
    const fallback: { hideOverlap: boolean; x?: number; align?: "right" } = { hideOverlap: true };
    if (w && r.x + r.width > w - 4) { fallback.x = p.rect.x - 7; fallback.align = "right"; }
    if (!visible[index]) return fallback;
    for (const dy of [0, -16, 16, -32, 32, -48, 48, -64, 64]) for (const right of [true, false]) {
      const x = right ? p.rect.x + p.rect.width + 7 : p.rect.x - 7;
      const y = p.rect.y + p.rect.height / 2 + dy;
      const box = { x: right ? x : x - r.width, y: y - r.height / 2, width: r.width, height: r.height };
      if (box.x < 4 || (w && box.x + box.width > w - 4) || box.y < 24 || (h && box.y + box.height > h - 40)) continue;
      if (occupied.some(b => box.x < b.x + b.width + 3 && box.x + box.width + 3 > b.x && box.y < b.y + b.height + 3 && box.y + box.height + 3 > b.y)) continue;
      occupied.push(box);
      return { x, y, align: right ? "left" : "right", verticalAlign: "middle", hideOverlap: false };
    }
    // No nearby slot fits. Keep this label outside the clipped canvas, rather than letting the
    // renderer's mark-size heuristic hide a higher-priority label that already has a safe slot.
    return { x: -10000, y: -10000, hideOverlap: true };
  };
}
