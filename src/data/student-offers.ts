/**
 * Official student offers, a DISPLAY overlay on the plan picker (Data → Subscription plans → Plan prices: Student).
 * Nothing here feeds prices, ranking, stats or comparisons: those always use the regular fee. Only offers a lab's own page
 * states are listed (never a reseller's, never a code); a lab with no current offer has no entry. Re-read `url` and update
 * `checked` when touching an entry. `activeStudentOffers` hides an offer once its `deadline` passes.
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
  checked: string;
}

export const STUDENT_OFFERS: StudentOffer[] = [
  {
    labId: "google", plan: "Google AI Pro", studentFeeUsd: 0, months: 12, regularFeeUsd: 19.99,
    eligibility: "College students in the US, 18 or older. Eligibility is verified each year. A payment method is required and it renews at $19.99/mo unless cancelled.",
    url: "https://gemini.google/us/students", deadline: "2026-12-31", checked: "2026-11-16",
  },
  {
    labId: "google", plan: "Google AI Plus", studentFeeUsd: 0, months: 12, regularFeeUsd: 4.99,
    eligibility: "College students outside the US in the 140+ markets that sell AI Plus (not Bolivia, Albania, Canada, Macau, Hong Kong or Tunisia). A payment method is required and it renews at $4.99/mo or the local price unless cancelled.",
    url: "https://blog.google/innovation-and-ai/products/gemini-app/student-offer-google-ai/", deadline: "2026-12-31", checked: "2026-11-16",
  },
  {
    labId: "mistral", plan: "Mistral Vibe Pro", studentFeeUsd: 5.99, months: 12, regularFeeUsd: 14.99,
    eligibility: "Students at accredited higher-education institutions with an email address their institution issued (personal addresses, student IDs and enrollment letters do not count). For people who have not used Vibe or Le Chat before.",
    url: "https://help.mistral.ai/en/articles/698530-i-m-a-student-or-a-teacher-am-i-eligible-for-a-discount", checked: "2026-11-16",
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
