export const SHARE_DESIGNS = [
  { id: "board", name: "Leaderboard" },
  { id: "qr", name: "Leaderboard + QR" },
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
  { id: "radar", name: "Strengths radar" },
] as const;

export type ShareDesign = (typeof SHARE_DESIGNS)[number]["id"];

export function isShareDesign(value: string | undefined): value is ShareDesign {
  return SHARE_DESIGNS.some((design) => design.id === value);
}

/** Designs shown in the first-visit intro; pre-rendered to public/intro/<design>.png by the scrape. */
export const INTRO_CARDS = ["podium", "board", "spotlight"] as const satisfies readonly ShareDesign[];
