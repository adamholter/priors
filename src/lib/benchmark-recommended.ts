/** How much a doubling of the pages that use a benchmark adds to its recommended score. */
export const USE_LIFT = 12;
/** Quality, lifted by how many published pages weight it: a benchmark people actually use rises within its quality band. */
export const recommendedScore = (x: { quality: number; uses: number }) => x.quality + USE_LIFT * Math.log2(1 + x.uses);
