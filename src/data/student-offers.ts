import type { SubscriptionPrice } from "./subscription";

/**
 * Official student offers (Data → Subscription plans → Plan prices: Student). A view choice kept in this browser: with it on, cost
 * charts price a plan an offer covers at the student fee (`withStudentOffers`, applied through `ViewOptions.studentOffers`).
 * Rankings, scores, links, saved pages, share cards and the default view always use the regular fee. Only offers a lab's own page
 * states are listed (never a reseller's, never a code); a lab with no current offer has no entry. Re-read `url` (and the terms it
 * links) and update `checked` when touching an entry. `activeStudentOffers` hides an offer once its `deadline` passes.
 */
export interface StudentOffer {
  labId: string;
  /** The plan as the plan picker names it. */
  plan: string;
  /** What a verified student pays per month for `months`, then the regular fee. 0 is free. */
  studentFeeUsd: number;
  months: number;
  /** The regular fee, so the saving reads without the snapshot. */
  regularFeeUsd: number;
  eligibility: string;
  /** The lab's own page for the offer. */
  url: string;
  /** Last day to claim, `YYYY-MM-DD`. */
  deadline?: string;
  /**
   * Only these models get the student fee; any other model on the plan keeps its regular price, because the offer does not
   * include it. Absent when the offer is the full plan. Google's free year counts as a trial in Antigravity, where every Google
   * row Priors has was measured: trials get no Gemini 4 Argon or Claude 5.5 (Antigravity's models table and forum staff,
   * November 13, 2026), and Hydrogen reaches paid plans before trials.
   */
  models?: string[];
  checked: string;
}

export const STUDENT_OFFERS: StudentOffer[] = [
  {
    labId: "google", plan: "Google AI Pro", studentFeeUsd: 0, months: 12, regularFeeUsd: 19.99,
    eligibility: "Students at a US college, 18 or older, verified through SheerID with a personal Google Account (no family group, supervised account or school-issued Workspace account). New users, or students whose 2025 AI Pro trial has expired. A payment method is required and it renews at $19.99/mo unless cancelled. Google's Offer Terms say usage limits may differ from a paid plan. In Antigravity the free year counts as a trial: no Gemini 4 Argon or Claude 5.5 until a paid billing cycle starts, and Hydrogen comes to trials after paid plans, so only Gemini 3.8 Flash is priced at the student fee here. A paid, discounted student plan counts as regular Pro.",
    url: "https://gemini.google/us/students", deadline: "2026-12-31", checked: "2026-11-16",
    // In Antigravity the free year is "Pro (Trial)": antigravity.google/docs/models (Argon needs a paid plan, Claude 5.5 a non-trial one)
    // and discuss.ai.google.dev/t/google-ai-pro-student-offer/199844 (unlocks "once a paid billing cycle is active"); Hydrogen goes to
    // paid, non-trial plans first. A paid, discounted student plan is regular paid Pro, but Google publishes no price for it.
    models: ["gemini-3.8-flash"],
  },
  {
    labId: "mistral", plan: "Mistral Vibe Pro", studentFeeUsd: 5.99, months: 12, regularFeeUsd: 14.99,
    eligibility: "Verified students at accredited higher-education institutions, for a maximum of 12 months, with an institutional email address (personal addresses, student IDs and enrollment letters do not count). Mistral's help page lets an existing account switch to the institutional email; its pricing page says the price is for people who have not used Vibe or Le Chat before, so a prior user may not qualify. Teachers can also verify for the Education plan, but Mistral publishes the $5.99 price only for students.",
    url: "https://mistral.ai/pricing", checked: "2026-11-16",
  },
];

/** The offers still open on `today` (`YYYY-MM-DD`). */
export const activeStudentOffers = (today: string, offers: readonly StudentOffer[] = STUDENT_OFFERS) => offers.filter((o) => !o.deadline || o.deadline >= today);

const usd = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;
/** "free for 12 months" or "$5.99/mo for 12 months". */
export const studentPriceText = (o: StudentOffer) => `${o.studentFeeUsd === 0 ? "free" : `${usd(o.studentFeeUsd)}/mo`} for ${o.months} months`;
/** What the student keeps over the offer. */
export const studentSavingUsd = (o: StudentOffer) => +((o.regularFeeUsd - o.studentFeeUsd) * o.months).toFixed(2);
/** How many times the plan's API value per dollar a student gets; absent when free. */
export const studentValueMultiple = (o: StudentOffer) => o.studentFeeUsd > 0 ? +(o.regularFeeUsd / o.studentFeeUsd).toFixed(1) : undefined;
/** The note a plan's option carries when student prices are on: " · student free for 12 months", or nothing when no offer covers it. */
export const studentOptionNote = (offers: readonly StudentOffer[], labId: string, plan: string) => { const o = offers.find((x) => x.labId === labId && x.plan === plan); return o ? ` · student ${studentPriceText(o)}` : ""; };
/** Today as `YYYY-MM-DD` in UTC. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

/** The offer covering a plan as pricing names it, including an assumed price ("Google AI Pro (assumed same as Flash)"). */
const offerFor = (offers: readonly StudentOffer[], labId: string | undefined, plan: string) =>
  offers.find((o) => o.labId === labId && (plan === o.plan || plan.startsWith(`${o.plan} (`)));

/**
 * Plan prices with student offers applied, for cost charts only: a covered plan's share of API price scales by student fee over
 * regular fee, so a free offer prices its models at 0 (the free column). Free tiers, plans no offer covers and models an offer
 * leaves out (`models`) are unchanged.
 */
export function withStudentOffers(prices: Map<string, SubscriptionPrice>, labOf: (modelId: string) => string | undefined, offers: readonly StudentOffer[]): Map<string, SubscriptionPrice> {
  if (!offers.length) return prices;
  const out = new Map(prices);
  for (const [id, p] of prices) {
    const o = p.ratio > 0 ? offerFor(offers, labOf(id), p.plan) : undefined;
    if (!o || (o.models && !o.models.includes(id))) continue;
    const k = o.studentFeeUsd / o.regularFeeUsd;
    out.set(id, { ...p, ratio: p.ratio * k, ...(p.aaCostRatio != null ? { aaCostRatio: p.aaCostRatio * k } : {}), plan: `${p.plan}, student offer`, feeUsd: o.studentFeeUsd });
  }
  return out;
}
