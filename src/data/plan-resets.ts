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
 * Banked resets (granted once, applied whenever the subscriber chooses within a month) count too, each once, on the day it was
 * granted. The source records grants, never when anyone applied one, so a banked reset cannot be counted twice; the
 * regular resets are separate announcements, and a banked one is an extra allowance on top of them:
 * - **Claude, full banked reset** (Nov 10, 2026: "across all models and limits"): one whole allowance, like a regular reset.
 * - **Claude, Fable 5.2 grant** (Nov 9, 2026, `refills: "fable"`): each restores the Fable usage on the weekly meter (Fable
 *   stops at half the week, so at full use that is half an allowance of the shared limit) and refills Fable's own cap. So for
 *   Opus, Sonnet and Haiku it adds 0.5 of a weekly allowance; for Fable it adds a whole Fable allowance (Fable's half of the
 *   week, again), twice what it adds for the others. Accounts hold 1 to 3 by paid tenure (Max and Ultra: 1 under 6 months, 2 at
 *   6 to 12, 3 over 12; Pro and standard Team: 1). Priors cannot know a visitor's tenure: it assumes 1, the number every
 *   eligible account has, and the visitor can say how many they hold (`fableResets` on an index).
 * - **OpenAI banked reset**: applying it restarts the week at a time Priors cannot see, so it is worth the average 0.5 of an
 *   allowance; it does not move the clock the regular resets are measured on. A `both` event is a regular reset plus a banked one.
 * Not counted: resets only some users got ("affected users" after an incident).
 * The window is a rolling 30 days, so the adjustment moves with the news.
 */
export const RESET_WINDOW_DAYS = 30;
const DAY_MS = 86_400_000, WEEK_DAYS = 7, ALLOWANCES = RESET_WINDOW_DAYS / WEEK_DAYS;
/** Fable 5.2 grants a visitor is assumed to hold: the number every eligible account got. */
export const DEFAULT_FABLE_RESETS = 1;
export const MAX_FABLE_RESETS = 3;
/** Models a Claude Fable grant refills. */
export const isFableModel = (modelId: string) => /^claude-fable-/.test(modelId);

/** How a lab's reset treats the weekly clock. Labs not listed keep their clock (a reset is a bonus). */
export type ResetClock = "fixed" | "restart";
export const RESET_CLOCKS: Record<string, ResetClock> = { openai: "restart", anthropic: "fixed" };

/** A reset that refills everyone on the plan, whatever the lab calls it. */
const counts = (e: PlanResetEvent) => !/affected/i.test(e.scope ?? "");
/** Moves the weekly clock (a regular reset, or the regular half of a `both`). */
const regular = (e: PlanResetEvent) => e.kind !== "banked" && counts(e);

/** Resets that count: regular and banked ones inside the window ending at `asOf`, for everyone on the plan. */
export function countedResets(events: PlanResetEvent[], asOf: number, days = RESET_WINDOW_DAYS): PlanResetEvent[] {
  return events.filter((e) => { const t = Date.parse(e.at); return counts(e) && t > asOf - days * DAY_MS && t <= asOf; });
}

export interface ResetOptions {
  /** Count for a Fable model (a Fable grant is a whole Fable allowance) instead of the lab's other models (half a weekly allowance). */
  fable?: boolean;
  /** Fable 5.2 grants the subscriber holds (1 to 3). */
  fableResets?: number;
}

/**
 * Extra allowances the counted resets in the window gave a subscriber who spends every allowance, in the allowance of the
 * model asked about (Fable's is its half of the week). Fixed clock: one per regular or full banked reset. Restart clock:
 * 1 - x per regular reset, x being how far into its week it landed, and 0.5 per banked one. Fable grants: see above.
 */
export function extraWeeks(events: PlanResetEvent[], asOf: number, clock: ResetClock, days = RESET_WINDOW_DAYS, opts: ResetOptions = {}): number {
  const inWindow = (t: number) => t > asOf - days * DAY_MS && t <= asOf;
  const clockTimes = events.filter(regular).map((e) => Date.parse(e.at)).filter(Number.isFinite).sort((a, b) => a - b);
  const grants = Math.max(0, Math.min(MAX_FABLE_RESETS, Math.round(opts.fableResets ?? DEFAULT_FABLE_RESETS)));
  let total = 0;
  for (const t of clockTimes.filter(inWindow)) {
    if (clock === "fixed") { total += 1; continue; }
    const before = clockTimes.filter((u) => u < t).at(-1);
    // The first reset on record has no earlier week to measure from: take the average landing point.
    const x = before === undefined ? 0.5 : (((t - before) / DAY_MS) % WEEK_DAYS) / WEEK_DAYS;
    total += 1 - x;
  }
  for (const e of events) {
    const t = Date.parse(e.at);
    if (!counts(e) || !inWindow(t) || e.kind === "reset") continue; // a banked reset, or the banked half of a `both`
    if (e.refills === "fable") total += grants * (opts.fable ? 1 : 0.5);
    else total += clock === "fixed" ? 1 : 0.5;
  }
  return total;
}

export interface PlanResetBoost {
  labId: string; plan: string; source: string; url: string;
  /** Counted resets in the window, banked ones included (a Fable grant counts as the number held). */
  resets: number;
  /** Of those, banked. */
  banked: number;
  /** Fable grants counted (0 when the window has none). */
  fableResets: number;
  clock: ResetClock;
  /** Allowances of extra usage they gave a subscriber who spends each one (see `extraWeeks`). */
  weeks: number;
  /** Times more usage a month of the plan buys because of them (1 = none). The plan's price share is divided by this. */
  boost: number;
  /** The same for Fable models, when a Fable grant makes them differ. */
  fable?: { weeks: number; boost: number };
  /** Most recent reset of any kind, ISO. */
  latest?: string;
}

/** What each lab's resets are worth to its plan, as of the snapshot. */
export function planResetBoosts(snapshot: Snapshot, opts: Pick<ResetOptions, "fableResets"> = {}): Map<string, PlanResetBoost> {
  const asOf = Date.parse(snapshot.generatedAt) || Date.parse(`${snapshot.date}T23:59:59Z`);
  const out = new Map<string, PlanResetBoost>();
  if (!Number.isFinite(asOf)) return out;
  const grantsHeld = Math.max(0, Math.min(MAX_FABLE_RESETS, Math.round(opts.fableResets ?? DEFAULT_FABLE_RESETS)));
  for (const r of snapshot.planResets ?? []) {
    const clock = RESET_CLOCKS[r.labId] ?? "fixed", counted = countedResets(r.events, asOf);
    const fableGrants = counted.some((e) => e.refills === "fable") ? grantsHeld : 0;
    const banked = counted.filter((e) => e.kind !== "reset" && e.refills !== "fable").length + fableGrants;
    const resets = counted.filter((e) => e.kind !== "banked").length + banked;
    const weeks = extraWeeks(r.events, asOf, clock, RESET_WINDOW_DAYS, opts);
    const fableWeeks = fableGrants ? extraWeeks(r.events, asOf, clock, RESET_WINDOW_DAYS, { ...opts, fable: true }) : undefined;
    const latest = r.events.map((e) => e.at).filter((t) => Date.parse(t) <= asOf).sort().at(-1);
    out.set(r.labId, { labId: r.labId, plan: r.plan, source: r.source, url: r.url, resets, banked, fableResets: fableGrants, clock, weeks, boost: 1 + weeks / ALLOWANCES,
      ...(fableWeeks != null ? { fable: { weeks: fableWeeks, boost: 1 + fableWeeks / ALLOWANCES } } : {}), latest });
  }
  return out;
}

/** The boost for one model: a Fable model gets its own when a Fable grant is in the window. */
export function resetBoostFor(b: PlanResetBoost | undefined, modelId: string): number {
  return !b ? 1 : isFableModel(modelId) && b.fable ? b.fable.boost : b.boost;
}

/** Whether the window holds a Claude Fable grant, so the settings ask how many the visitor holds. */
export function hasFableGrant(snapshot: Snapshot): boolean {
  return [...planResetBoosts(snapshot).values()].some((b) => b.fableResets > 0);
}

const LAB_NAMES: Record<string, string> = { openai: "OpenAI", anthropic: "Anthropic" };
const x = (n: number) => `${n.toFixed(2).replace(/\.?0+$/, "")}×`;
/** Per lab, what is being counted: for the settings panel. */
export function planResetRows(snapshot: Snapshot, opts: Pick<ResetOptions, "fableResets"> = {}): { lab: string; text: string }[] {
  return [...planResetBoosts(snapshot, opts).values()].map((b) => ({ lab: LAB_NAMES[b.labId] ?? b.labId,
    text: `${b.resets} reset${b.resets === 1 ? "" : "s"} in 30 days${b.banked ? ` (${b.banked} banked${b.fableResets ? `, ${b.fableResets} of them Fable-only` : ""})` : ""}${b.resets ? `, plans ${x(b.boost)} cheaper` : ""}${b.fable ? `, Fable ${x(b.fable.boost)}` : ""}` }));
}
/** The caveat behind those rows. Undefined without reset data. */
export function planResetNote(snapshot: Snapshot, opts: Pick<ResetOptions, "fableResets"> = {}): string | undefined {
  const rows = planResetRows(snapshot, opts);
  if (!rows.length) return undefined;
  return `${rows.map((r) => `${r.lab}: ${r.text}`).join(" · ")}. Banked resets count once, when granted. A Claude reset is a bonus on top of its weekly limits; an OpenAI reset restarts the week, so it adds less the later in the week it lands (a banked one counts as half). A Claude Fable grant restores Fable's half of the week, so it adds a whole allowance for Fable 5.2 and half of one for other Claude models.`;
}
