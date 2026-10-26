import { createValsSource } from "./_vals";

export default createValsSource({
  sourceId: "vals-poker-agent",
  slug: "poker_agent",
  benchmarkId: "vals-poker-agent",
  name: "Poker Agent",
  category: "other",
  unit: "elo",
  description: "TrueSkill rating for language models playing multiplayer no-limit Texas Hold'em; Vals scales ratings by 40 on a 1000-point baseline.",
});
