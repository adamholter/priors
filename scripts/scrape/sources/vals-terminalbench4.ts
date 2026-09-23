import { createValsSource } from "./_vals";

export default createValsSource({
  sourceId: "vals-terminalbench4",
  slug: "terminal-bench-4",
  benchmarkId: "vals-terminal-bench-4",
  name: "Terminal-Bench 4.0",
  shortName: "Vals TB 4.0",
  category: "agentic",
  description: "Vals AI's Terminal-Bench 4.0 aggregate scores from its external-runner leaderboard. Vals publishes a separate system set and score series from the tbench.ai harness-plus-model leaderboard, so the two sources remain distinct.",
  eligibleForDefault: false,
  defaultWeight: 0,
});
