/** Pure helpers for the leaderboard's rows: which neighbours tie, how a tie reads, how a lab is named. */

export type Tie = { first: number; last: number; size: number; text: string };

/** Groups of neighbouring rows whose displayed score is the same text, keyed by the id the caller gives each row. Rows must be in rank order. */
export function tiesOf(items: { id: string; rank: number; text: string }[]): Map<string, Tie> {
  const out = new Map<string, Tie>();
  for (let i = 0; i < items.length;) {
    let j = i + 1;
    while (j < items.length && items[j].text === items[i].text) j++;
    if (j - i > 1) for (let k = i; k < j; k++) out.set(items[k].id, { first: items[i].rank, last: items[j - 1].rank, size: j - i, text: items[i].text });
    i = j;
  }
  return out;
}

/** `=23` on every row of a tie (a bare number from rank 100, where it would not fit), the rank alone with no tie. */
export const tieLabel = (tie: Tie | undefined, rank: number) => (!tie ? String(rank) : tie.first >= 100 ? String(tie.first) : `=${tie.first}`);

/** A lab's display name. The snapshot names some labs by their lowercase id, which reads better capitalized. */
export function labTitle(name: string | undefined, id: string): string {
  const n = name ?? id;
  return n === n.toLowerCase() ? n.charAt(0).toUpperCase() + n.slice(1) : n;
}

/** A bar's score at the precision the row shows, so rows that read the same also draw the same. A formatted benchmark value keeps its own number. */
export const shownScore = (score: number, formatted: boolean) => (formatted ? score : Number(score.toFixed(1)));
