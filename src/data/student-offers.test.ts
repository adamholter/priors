import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { activeStudentOffers, STUDENT_OFFERS, studentPriceText, studentSavingUsd, studentValueMultiple } from "./student-offers";
import { computeIndex, defaultConfig, PAGE_VIEW } from "@/engine/index";
import { currentPlanName, subscriptionPlanOptions, subscriptionPrices } from "./subscription";
import type { Snapshot } from "./types";

const snapshot = JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString()) as Snapshot;

describe("student offers", () => {
  it("lists only offers with an official https page, eligibility and a check date", () => {
    for (const o of STUDENT_OFFERS) {
      expect(o.url).toMatch(/^https:\/\/(gemini\.google|blog\.google|mistral\.ai)\//);
      expect(o.eligibility.length).toBeGreaterThan(40);
      expect(o.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.studentFeeUsd).toBeLessThan(o.regularFeeUsd);
    }
  });

  it("states each lab page's own terms: Mistral's existing-account switch and teachers, Google's one-year Pro plan and usage-limit caveat", () => {
    const by = (plan: string) => STUDENT_OFFERS.find((o) => o.plan === plan)!;
    expect(by("Mistral Vibe Pro").url).toBe("https://mistral.ai/pricing");
    expect(by("Mistral Vibe Pro").eligibility).toMatch(/existing account[\s\S]*Teachers[\s\S]*only for students/);
    expect(by("Google AI Pro")).toMatchObject({ studentFeeUsd: 0, months: 12, regularFeeUsd: 19.99, deadline: "2026-12-31" });
    for (const p of ["Google AI Pro"]) expect(by(p).eligibility).toMatch(/usage limits may differ/);
  });

  it("names plans the snapshot sells, at the fee the snapshot lists", () => {
    const fees = new Map<string, number>();
    const walk = (x: unknown): void => { if (x && typeof x === "object") { const p = x as { plan?: unknown; feeUsd?: unknown }; if (typeof p.plan === "string" && typeof p.feeUsd === "number") fees.set(currentPlanName(p.plan), p.feeUsd); Object.values(x).forEach(walk); } };
    walk(snapshot.observations.filter((o) => o.benchmarkId.includes("subscription")));
    // The checked-in snapshot is the last archived day; a plan added since lives in the scraper's overrides.
    const overrides = readFileSync("scripts/scrape/sources/subscription-overrides.ts", "utf8");
    for (const o of STUDENT_OFFERS) {
      const fee = fees.get(currentPlanName(o.plan)) ?? Number(overrides.match(new RegExp(`plan: "${o.plan}", feeUsd: ([\\d.]+)`))?.[1]);
      expect(fee, o.plan).toBe(o.regularFeeUsd);
    }
  });

  it("hides an offer after its deadline and keeps open-ended ones", () => {
    expect(activeStudentOffers("2026-12-31").map((o) => o.plan)).toEqual(STUDENT_OFFERS.map((o) => o.plan));
    expect(activeStudentOffers("2027-01-01").map((o) => o.plan)).toEqual(["Mistral Vibe Pro"]);
  });

  it("describes price, saving and value from the offer alone", () => {
    const [pro, mistral] = STUDENT_OFFERS;
    expect(studentPriceText(pro)).toBe("free for 12 months");
    expect(studentSavingUsd(pro)).toBe(239.88);
    expect(studentValueMultiple(pro)).toBeUndefined();
    expect(studentPriceText(mistral)).toBe("$5.99/mo for 12 months");
    expect(studentValueMultiple(mistral)).toBe(2.5);
  });

  it("lists each open offer as a plan option beside the plan it discounts, at the student fee", () => {
    const options = subscriptionPlanOptions(snapshot), lab = (id: string) => options.find((l) => l.labId === id);
    const pro = lab("google")!.plans.find((p) => p.plan === "Google AI Pro (Student)");
    expect(pro).toMatchObject({ feeUsd: 0 });
    // Only the models the free year covers (a trial in Antigravity): fewer than the regular plan's.
    expect(pro!.models).toBeLessThan(lab("google")!.plans.find((p) => p.plan === "Google AI Pro")!.models);
    const vibe = lab("mistral")?.plans.find((p) => p.plan === "Mistral Vibe Pro (Student)");
    if (vibe) expect(vibe.feeUsd).toBe(5.99);
    // Never anyone's median: no model defaults to a student option.
    for (const l of options) expect(l.median.some((m) => / \(Student\)$/.test(m.plan)), l.labId).toBe(false);
  });

  it("prices a picked student option at the student fee for the models it covers, and leaves the rest at the regular plan", () => {
    const regular = subscriptionPrices(snapshot, { google: "Google AI Pro" }), student = subscriptionPrices(snapshot, { google: "Google AI Pro (Student)" });
    const onPro = (re: RegExp) => [...regular.keys()].find((id) => re.test(id) && /^Google AI Pro/.test(regular.get(id)!.plan));
    const flash = onPro(/^gemini-3\.8-flash$/), hydrogen = onPro(/hydrogen/), argon = onPro(/^gemini-4$/);
    expect(flash, "3.8 Flash is priced on Google AI Pro").toBeTruthy();
    expect(student.get(flash!)).toMatchObject({ ratio: 0, feeUsd: 0, plan: "Google AI Pro (Student)" });
    // The free year is a trial in Antigravity: Hydrogen and Argon are not in it, so they keep the paid price.
    for (const id of [hydrogen, argon]) if (id) expect(student.get(id), id).toEqual(regular.get(id));
    for (const [id, p] of regular) if (id !== flash) expect(student.get(id), id).toEqual(p);
    // The offer covers Mistral's own models: another lab's model a Mistral plan also sells keeps its price.
    const labOf = new Map(snapshot.models.map((m) => [m.id, m.labId])), prices = [...subscriptionPrices(snapshot)];
    const mistral = prices.find(([id, p]) => p.plan === "Mistral Vibe Pro" && labOf.get(id) === "mistral");
    const other = prices.find(([id, p]) => p.plan === "Mistral Vibe Pro" && labOf.get(id) !== "mistral");
    if (other) expect(subscriptionPrices(snapshot, { mistral: "Mistral Vibe Pro (Student)" }).get(other[0])).toEqual(other[1]);
    if (mistral) {
      const picked = subscriptionPrices(snapshot, { mistral: "Mistral Vibe Pro (Student)" }).get(mistral[0])!;
      expect(picked.ratio).toBeCloseTo(mistral[1].ratio * 5.99 / 14.99, 12);
      expect(picked).toMatchObject({ plan: "Mistral Vibe Pro (Student)", feeUsd: 5.99 });
    }
  });

  it("is never the default: unpicked prices and rankings stay at the regular fee, and a pick moves cost only", () => {
    expect([...subscriptionPrices(snapshot).values()].some((p) => / \(Student\)/.test(p.plan))).toBe(false);
    const config = { ...defaultConfig(snapshot), costBasis: "subscription" as const, variants: "all" as const };
    const before = computeIndex(snapshot, config, PAGE_VIEW), after = computeIndex(snapshot, { ...config, subscriptionPlans: { google: "Google AI Pro (Student)" } }, PAGE_VIEW);
    const ranks = (r: typeof before) => r.ranked.map((x) => `${x.variant.id}:${x.rank}:${x.score}`);
    expect(ranks(after)).toEqual(ranks(before));
    const cost = (r: typeof before, re: RegExp) => r.ranked.find((x) => re.test(x.model.id) && x.costUsd != null);
    expect(cost(before, /^gemini-3\.8-flash$/)!.costUsd).toBeGreaterThan(0);
    expect(cost(after, /^gemini-3\.8-flash$/)!.costUsd).toBe(0);
    // Models the free year leaves out are priced on the regular plan it discounts (which need not be the lab's default).
    const regular = computeIndex(snapshot, { ...config, subscriptionPlans: { google: "Google AI Pro" } }, PAGE_VIEW);
    // Any Google model priced on the plan but not Flash (Hydrogen, Neon, Carbon: whichever has a cost in this snapshot).
    const left = regular.ranked.find((x) => x.model.labId === "google" && !/^gemini-3\.8-flash$/.test(x.model.id) && x.costUsd != null)!;
    expect(left).toBeDefined();
    expect(after.ranked.find((x) => x.variant.id === left.variant.id)!.costUsd).toBe(left.costUsd);
    expect(after.ranked.filter((x) => x.costUsd !== before.ranked.find((y) => y.variant.id === x.variant.id)!.costUsd).every((x) => x.model.labId === "google")).toBe(true);
  });

  it("has no Regular/Student or Peak hours toggle any more: both are plan options", () => {
    for (const f of ["src/lib/student-pricing-pref.ts", "src/lib/peak-hours-pref.ts"]) expect(existsSync(f), f).toBe(false);
    const picker = readFileSync("src/components/chart/PlanPicker.tsx", "utf8");
    expect(picker).not.toMatch(/Plan prices|Peak hours|setStudentPricingPref|setPeakHoursPref/);
    for (const f of ["src/engine/index.ts", "src/components/Builder.tsx", "src/components/page/IndexPage.tsx", "src/components/benchmark/BenchmarkPage.tsx"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/studentOffers|peakHours/);
  });
});
