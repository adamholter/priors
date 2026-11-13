/**
 * The CDN cache tag on every response built from the live snapshot. The scrape job purges it after it publishes new data
 * (scripts/ops/data-pointer.mjs purge), so a cached answer never outlives the data it was made from.
 */
export const DATA_CACHE_TAG = "priors-data";
export const DATA_TAG_HEADER = { "Vercel-Cache-Tag": DATA_CACHE_TAG } as const;
