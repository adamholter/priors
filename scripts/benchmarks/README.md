Run `npm run benchmark:identity`. Run `npm run benchmark:identity -- --baseline` to score the frozen IDs from the broken production snapshot.

The reviewed dataset covers AA structured records, VALS catalog keys, cross-source aliases, different model versions and efforts, pinned releases, fallback modes, token budgets, harnesses and unknown keys. It scores exact identities and every pair of records for false merges and false splits. The captured builder URL and snapshot must produce 11 distinct model/effort rows, rather than the original 18. Vitest runs this benchmark in CI.

For a new parsing defect, add the source label/key and independently reviewed expected identity to `fixtures/identity-cases.json`. Keep the original source ID in `legacyVariantId`. Add both a matching alias and a nearby name that must stay separate. Do not change expected groups to match the parser's output.

`src/data/canonical-snapshot.test.ts` also checks measured-score arithmetic, preservation of every observation field, source lineage, conflicting measurements, legacy highlights and repeat normalization.
