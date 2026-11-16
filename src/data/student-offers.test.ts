import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { activeStudentOffers, STUDENT_OFFERS, studentOptionNote, studentPriceText, studentSavingUsd, studentValueMultiple } from "./student-offers";
import { currentPlanName, subscriptionPlanOptions, subscriptionPrices } from "./subscription";
import { planPrices } from "@/lib/plan-prices";
import type { Snapshot } from "./types";

const snapshot = JSON.parse(gunzipSync(readFileSync("data/snapshots/latest.json.gz")).toString()) as Snapshot;

describe("student offers", () => {
  it("lists only offers with an official https page, eligibility and a check date", () => {
    for (const o of STUDENT_OFFERS) {
      expect(o.url).toMatch(/^https:\/\/(gemini\.google|blog\.google|help\.mistral\.ai)\//);
      expect(o.eligibility.length).toBeGreaterThan(40);
      expect(o.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.studentFeeUsd).toBeLessThan(o.regularFeeUsd);
    }
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
    const [pro, , mistral] = STUDENT_OFFERS;
    expect(studentPriceText(pro)).toBe("free for 12 months");
    expect(studentSavingUsd(pro)).toBe(239.88);
    expect(studentValueMultiple(pro)).toBeUndefined();
    expect(studentPriceText(mistral)).toBe("$5.99/mo for 12 months");
    expect(studentValueMultiple(mistral)).toBe(2.5);
    expect(studentOptionNote(STUDENT_OFFERS, "mistral", "Mistral Vibe Pro")).toBe(" · student $5.99/mo for 12 months");
    expect(studentOptionNote(STUDENT_OFFERS, "openai", "ChatGPT Plus")).toBe("");
  });

  it("never changes what prices, ranks or compares: the overlay is read-only and the pricing code never reads it", () => {
    const before = JSON.stringify([[...subscriptionPrices(snapshot)], subscriptionPlanOptions(snapshot), planPrices(snapshot)]);
    const frozen = STUDENT_OFFERS.map((o) => Object.freeze({ ...o }));
    for (const o of frozen) { studentPriceText(o); studentSavingUsd(o); studentValueMultiple(o); }
    studentOptionNote(frozen, "google", "Google AI Pro"); activeStudentOffers("2026-11-16", frozen);
    expect(JSON.stringify([[...subscriptionPrices(snapshot)], subscriptionPlanOptions(snapshot), planPrices(snapshot)])).toBe(before);
    expect(STUDENT_OFFERS.map((o) => o.regularFeeUsd)).toEqual(frozen.map((o) => o.regularFeeUsd));
    for (const f of ["src/data/subscription.ts", "src/lib/plan-prices.ts", "src/engine/index.ts", "src/lib/metrics.ts", "src/lib/url.ts"]) expect(readFileSync(f, "utf8"), f).not.toMatch(/student-offers|student-pricing/);
  });
});
