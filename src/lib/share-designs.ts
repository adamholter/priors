export const SHARE_DESIGNS = [
  { id: "ranking", name: "Ranking bars" },
  { id: "podium", name: "Podium" },
  { id: "split", name: "Split field" },
  { id: "scoreboard", name: "Scoreboard" },
  { id: "staircase", name: "Staircase" },
  { id: "constellation", name: "Labeled frontier" },
  { id: "columns", name: "Standing columns" },
  { id: "race", name: "Finish line" },
  { id: "ledger", name: "Index ledger" },
  { id: "spotlight", name: "Winner spotlight" },
] as const;

export type ShareDesign = (typeof SHARE_DESIGNS)[number]["id"];

export function isShareDesign(value: string | undefined): value is ShareDesign {
  return SHARE_DESIGNS.some((design) => design.id === value);
}
