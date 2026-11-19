/** How much a doubling of the pages that use a benchmark adds to its recommended score. */
export const USE_LIFT = 12;
/** How much a doubling of its stars adds. Half a page's worth: a star costs a click, a page weights it in a real ranking. */
export const STAR_LIFT = 6;
/** Quality, lifted by how many published pages weight it and how many people starred it: a benchmark people actually use rises within its quality band. */
export const recommendedScore = (x: { quality: number; uses: number; stars?: number }) => x.quality + USE_LIFT * Math.log2(1 + x.uses) + STAR_LIFT * Math.log2(1 + (x.stars ?? 0));
