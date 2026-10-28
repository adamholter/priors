import type { PlanResetEvent, Snapshot } from "./types";

/**
 * Limit resets: now and then a lab refills everyone's weekly allowance early (OpenAI's Codex has done it 69 times since
 * September 2025, Claude a dozen). A subscriber who spends each allowance gets that usage on top of the plan, so a plan's
 * share of API price falls by the same factor. The scrape job keeps each lab's reset history (`scripts/scrape/plan-resets.ts`).
 *
 * What a reset is worth depends on what it does to the weekly clock, and the two labs differ:
 * - **Claude** ("Your weekly limits still reset on their usual day and time", Claude Help Center): the clock does not move,
 *   so a reset is a whole extra allowance on top of the regular weeks.
 * - **OpenAI** (a reset moves the weekly reset date; the next one comes 7 days later, Codex help): the week restarts at
 *   the reset, which replaces the rest of the old week, including its refill. A reset that lands x of the way through
 *   a week (x = time since the week started, as a fraction of 7 days) is worth 1 - x of an allowance: a reset two days
 *   after the last one adds 0.71, one that lands 6 days in adds 0.14. The week's start is the previous reset, then a
 *   7-day clock from it, so this is worked out from the real reset times.
 * Both assume the premise the plan prices already make ("at full use"): the subscriber spends each allowance.
 *
 * Not counted: banked resets (saved and applied at the user's own time; they make up for the gaps, so counting both would
 * count the allowance twice), and resets only some users got ("affected users" after an incident).
 * The window is a rolling 30 days, so the adjustment moves with the news.
 */
export const RESET_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000, WEEK_DAYS = 7;

/** How a lab's reset treats the weekly clock. Labs not listed keep their clock (a reset is a bonus). */
export type ResetClock = "fixed" | "restart";
export const RESET_CLOCKS: Record<string, ResetClock> = { openai: "restart", anthropic: "fixed" };

/** A reset that refills everyone on the plan, whatever the lab calls it. */
const counts = (e: PlanResetEvent) => e.kind !== "banked" && !/affected/i.test(e.scope ?? "");

/** Resets that count: regular ones inside the window ending at `asOf`, for everyone on the plan. */
export function countedResets(events: PlanResetEvent[], asOf: number, days = RESET_WINDOW_DAYS): PlanResetEvent[] {
  return events.filter((e) => { const t = Date.parse(e.at); return counts(e) && t > asOf - days * DAY_MS && t <= asOf; });
}

/**
 * Extra weeks of allowance the counted resets in the window gave a subscriber who spends every allowance.
 * Fixed clock: one per reset. Restart clock: 1 - x per reset, x being how far into its week the reset landed.
 */
export function extraWeeks(events: PlanResetEvent[], asOf: number, clock: ResetClock, days = RESET_WINDOW_DAYS): number {
  const all = events.filter(counts).map((e) => Date.parse(e.at)).filter(Number.isFinite).sort((a, b) => a - b);
  const inWindow = all.filter((t) => t > asOf - days * DAY_MS && t <= asOf);
  if (clock === "fixed") return inWindow.length;
  let total = 0;
  for (const t of inWindow) {
    const before = all.filter((u) => u < t).at(-1);
    // The first reset on record has no earlier week to measure from: take the average landing point.
    const x = before === undefined ? 0.5 : (((t - before) / DAY_MS) % WEEK_DAYS) / WEEK_DAYS;
    total += 1 - x;
  }
  return total;
}

export interface PlanResetBoost {
  labId: string; plan: string; source: string; url: string;
  /** Counted resets in the window. */
  resets: number;
  clock: ResetClock;
  /** Weeks of extra allowance they gave a subscriber who spends each one (see `extraWeeks`). */
  weeks: number;
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
    const clock = RESET_CLOCKS[r.labId] ?? "fixed", resets = countedResets(r.events, asOf).length, weeks = extraWeeks(r.events, asOf, clock);
    const latest = r.events.map((e) => e.at).filter((t) => Date.parse(t) <= asOf).sort().at(-1);
    out.set(r.labId, { labId: r.labId, plan: r.plan, source: r.source, url: r.url, resets, clock, weeks, boost: 1 + weeks / (RESET_WINDOW_DAYS / WEEK_DAYS), latest });
  }
  return out;
}

const LAB_NAMES: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic" };
const x = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, "")}×`;
/** One line for the settings panel: what is being counted. Undefined without reset data. */
export function planResetNote(snapshot: Snapshot): string | undefined {
  const boosts = [...planResetBoosts(snapshot).values()];
  if (!boosts.length) return undefined;
  const parts = boosts.map((b) => `${LAB_NAMES[b.labId] ?? b.labId}: ${b.resets} reset${b.resets === 1 ? "" : "s"} in 30 days${b.resets ? `, plans ${x(b.boost)} cheaper` : ""}`);
  return `${parts.join(" · ")}. Banked resets are not counted. A Claude reset is a bonus on top of its weekly limits; an OpenAI reset restarts the week, so it adds less the later in the week it lands.`;
}
