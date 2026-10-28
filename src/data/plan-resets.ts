import type { PlanResetEvent, Snapshot } from "./types";

/**
 * Limit resets: now and then a lab refills everyone's weekly allowance early (OpenAI's Codex has done it 69 times since
 * September 2025, Claude a dozen). A subscriber gets that usage on top of the plan, so a plan's share of API price
 * falls by the same factor. The scrape job keeps each lab's reset history (`scripts/scrape/plan-resets.ts`).
 *
 * The adjustment is a rolling 30 days, not a lifetime figure, and it is deliberately modest:
 * - Banked resets (saved to use later) are not counted: they make up for the long gaps between resets, so counting
 *   them as well would count the same allowance twice.
 * - A reset refills what was used, and it lands at a random point in someone's week, so on average it returns half a
 *   week's allowance (`RESET_REFUND_WEEKS`), not a whole one.
 * - A reset only some users got ("affected users" after an incident) is not counted.
 */
export const RESET_WINDOW_DAYS = 30;
export const RESET_REFUND_WEEKS = 0.5;
const DAY_MS = 86_400_000;

/** Resets that count: regular ones inside the window ending at `asOf`, for everyone on the plan. */
export function countedResets(events: PlanResetEvent[], asOf: number, days = RESET_WINDOW_DAYS): PlanResetEvent[] {
  return events.filter((e) => {
    const t = Date.parse(e.at);
    return e.kind !== "banked" && t > asOf - days * DAY_MS && t <= asOf && !/affected/i.test(e.scope ?? "");
  });
}

export interface PlanResetBoost {
  labId: string; plan: string; source: string; url: string;
  /** Counted resets in the window. */
  resets: number;
  /** Times more usage a month of the plan buys because of them (1 = none). The plan's price share is divided by this. */
  boost: number;
  /** Most recent reset of any kind, ISO. */
  latest?: string;
}

/** What each lab's resets are worth to its plan, as of the snapshot. */
export function planResetBoosts(snapshot: Snapshot): Map<string, PlanResetBoost> {
  const asOf = Date.parse(snapshot.generatedAt) || Date.parse(`${snapshot.date}T23:59:59Z`);
  const out = new Map<string, PlanResetBoost>();
  if (!Number.isFinite(asOf)) return out;
  for (const r of snapshot.planResets ?? []) {
    const resets = countedResets(r.events, asOf).length;
    const latest = r.events.map((e) => e.at).filter((t) => Date.parse(t) <= asOf).sort().at(-1);
    out.set(r.labId, { labId: r.labId, plan: r.plan, source: r.source, url: r.url, resets, boost: 1 + (resets * RESET_REFUND_WEEKS) / (RESET_WINDOW_DAYS / 7), latest });
  }
  return out;
}

const LAB_NAMES: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic" };
const x = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, "")}×`;
/** One line for the settings panel: what is being counted. Undefined without reset data. */
export function planResetNote(snapshot: Snapshot): string | undefined {
  const boosts = [...planResetBoosts(snapshot).values()];
  if (!boosts.length) return undefined;
  return boosts.map((b) => `${LAB_NAMES[b.labId] ?? b.labId}: ${b.resets} reset${b.resets === 1 ? "" : "s"} in 30 days${b.resets ? `, plans ${x(b.boost)} cheaper` : ""}`).join(" · ") + ". Banked resets are not counted; each counts as half a week of extra allowance.";
}
