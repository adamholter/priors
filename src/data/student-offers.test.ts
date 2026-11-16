import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { activeStudentOffers, STUDENT_OFFERS, studentOptionNote, studentPriceText, studentSavingUsd, studentValueMultiple, withStudentOffers } from "./student-offers";
import { computeIndex, defaultConfig, PAGE_VIEW } from "@/engine/index";
import { encodeIndex } from "@/lib/url";
import { currentPlanName, subscriptionPlanOptions, subscriptionPrices } from "./subscription";
import { planPrices } from "@/lib/plan-prices";
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
    expect(studentOptionNote(STUDENT_OFFERS, "mistral", "Mistral Vibe Pro")).toBe(" · student $5.99/mo for 12 months");
    expect(studentOptionNote(STUDENT_OFFERS, "openai", "ChatGPT Plus")).toBe("");
  });

  it("prices covered plans at the student fee and leaves free tiers and uncovered plans alone", () => {
    const regular = subscriptionPrices(snapshot), labOf = new Map(snapshot.models.map((m) => [m.id, m.labId]));
    const student = withStudentOffers(regular, (id) => labOf.get(id), STUDENT_OFFERS);
    const hydrogen = [...regular.keys()].find((id) => /hydrogen/.test(id) && /^Google AI Pro/.test(regular.get(id)!.plan));
    expect(hydrogen, "Hydrogen is priced on Google AI Pro").toBeTruthy();
    expect(student.get(hydrogen!)).toMatchObject({ ratio: 0, feeUsd: 0 });
    const mistral = [...regular].find(([, p]) => p.plan === "Mistral Vibe Pro")!;
    expect(student.get(mistral[0])!.ratio).toBeCloseTo(mistral[1].ratio * 5.99 / 14.99, 12);
    for (const [id, p] of regular) if (!/^(Google AI Pro|Google AI Plus|Mistral Vibe Pro)/.test(p.plan) || p.ratio === 0) expect(student.get(id), id).toEqual(p);
    expect(withStudentOffers(regular, (id) => labOf.get(id), [])).toBe(regular);
  });

  it("Student mode moves cost only: ranks, scores, the link and stored pricing stay the same", () => {
    const config = { ...defaultConfig(snapshot), costBasis: "subscription" as const, variants: "all" as const };
    const before = computeIndex(snapshot, config, PAGE_VIEW), after = computeIndex(snapshot, config, { ...PAGE_VIEW, studentOffers: STUDENT_OFFERS });
    const ranks = (r: typeof before) => r.ranked.map((x) => `${x.variant.id}:${x.rank}:${x.score}`);
    expect(ranks(after)).toEqual(ranks(before));
    expect(after.benchmarks).toEqual(before.benchmarks);
    const cost = (r: typeof before, re: RegExp) => r.ranked.find((x) => re.test(x.model.id) && x.costUsd != null);
    expect(cost(before, /hydrogen/)!.costUsd).toBeGreaterThan(0);
    expect(cost(after, /hydrogen/)!.costUsd).toBe(0);
    expect(after.ranked.filter((x) => x.costUsd !== before.ranked.find((y) => y.variant.id === x.variant.id)!.costUsd).every((x) => ["google", "mistral"].includes(x.model.labId))).toBe(true);
    expect(encodeIndex(after.config)).toBe(encodeIndex(before.config));
    expect(JSON.stringify([...subscriptionPrices(snapshot)])).toBe(JSON.stringify([...subscriptionPrices(snapshot)]));
  });

  it("stored pricing, links and plan price shares never read student offers", () => {
    const before = JSON.stringify([[...subscriptionPrices(snapshot)], subscriptionPlanOptions(snapshot), planPrices(snapshot)]);
    withStudentOffers(subscriptionPrices(snapshot), () => "google", STUDENT_OFFERS);
    expect(JSON.stringify([[...subscriptionPrices(snapshot)], subscriptionPlanOptions(snapshot), planPrices(snapshot)])).toBe(before);
    for (const f of ["src/data/subscription.ts", "src/lib/plan-prices.ts", "src/lib/metrics.ts", "src/lib/url.ts", "src/lib/og.tsx", "convex/validators.ts"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/student-offers|student-pricing|studentOffers/);
  });
});
