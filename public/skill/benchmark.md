# Priors: adding a benchmark to the user's page

Goal: a complete, honest dataset for one benchmark, imported with `import_benchmark` (needs the user's token).

1. **Find the source.** The benchmark's own public leaderboard: official site, paper or GitHub. Check `list_benchmarks` first, since Priors may already carry it. If the source is unreachable or paywalled, say so and stop.
2. **Take every row** the source publishes, not a sample. Per row:
   - `modelLabel`: the model name exactly as the source writes it, effort tags like "(high)" included. Priors matches names itself, and drops rows it cannot recognize.
   - `value`: the primary score as a number (percent as 0 to 100).
   - `effort`: `low`, `medium`, `high`, `xhigh` or `max`, only when the source shows a separate effort.
   - `ci`: `[low, high]` when published.
   - `costUsd`: measured cost per task or run, only when the source publishes it. A cost worked out from token prices is not one.
   - `outputTokens`, `steps`, `sourceUrl`: when published.
3. **List what is missing.** A model in the user's ranking that the benchmark has not evaluated goes in `missing` with a reason. Scores come only from the source: Priors estimates gaps itself and marks them.
4. **Write the payload:**
   ```json
   {
     "benchmark": {
       "id": "my-bench-v2",
       "name": "MyBench v2",
       "shortName": "MyBench",
       "url": "https://example.com/leaderboard",
       "description": "One or two sentences: what it measures and how it is scored.",
       "unit": "percent",
       "higherIsBetter": true,
       "category": "coding"
     },
     "rows": [
       { "modelLabel": "Claude Opus 5.5 (max)", "value": 71.2, "ci": [68.9, 73.5], "costUsd": 13.41, "sourceUrl": "https://example.com/leaderboard" }
     ],
     "missing": [ { "modelLabel": "Gemini 4 Argon", "reason": "not evaluated" } ]
   }
   ```
   - `unit`: `percent`, `score`, `elo`, `usd`, `seconds` or `count`.
   - `category`: `coding`, `agentic`, `reasoning`, `knowledge`, `math`, `long-context`, `instruction`, `creative`, `safety`, `economics`, `composite` or `other`.
   - `id`: a lowercase slug. Importing the same id again replaces the old data.
5. **Import** it with `import_benchmark`. The reply gives the accepted row count. Tell the user which model labels were not recognized.
6. **Put it in an index** when asked: `upsert_index` with the benchmark id added to that index's `weights` (send the whole `weights` object, since it is replaced as one).

Done when the reply reports the row count, every source row is accounted for as accepted or unrecognized, and `whoami` shows the id in the index's weights if the user asked for that.

If the benchmark would be useful to everyone on Priors, tell the user they can also ask for it at https://mypriors.com/request.
