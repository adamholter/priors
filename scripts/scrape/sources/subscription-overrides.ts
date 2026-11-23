import type { RawRow } from "../../../src/data/types";
import type { PlanCaveat } from "../../../src/data/subscription";

/**
 * Subsidy figures read straight from a published plan allowance, for models Real API Pricing does not
 * cover. `ratio` is what a subscriber pays as a share of API list price at full use (fee ÷ usage value),
 * so 6× subsidized is 1/6. Free tiers are not listed here: `scripts/scrape/free-tiers.ts` reads them live from OpenCode Zen and OpenRouter. Only figures at roughly 80% confidence or better belong here: a plan page that
 * states the allowance in dollars of usage, or a published measurement of a whole allowance for a model Real API Pricing has no usable row for, checked on `checked`. Each replaces any computed row for the model.
 */
export interface SubsidyOverride {
  /** Canonical model id the figure applies to (checked against computed rows). */
  modelId: string;
  /** Label the build normalizes, unless `identity` pins the model. */
  label: string;
  identity?: RawRow["identity"];
  plan: string;
  feeUsd: number;
  ratio: number;
  confidence: "high" | "medium";
  source: string;
  checked: string;
  note: string;
  /** Two honest ways to read the same measurement. The first is the default and is `ratio`; a viewer can switch (Advanced → Subscription plans → plan rate, `planReading` on an index). */
  readings?: SubsidyReading[];
}

/** One reading of a curated share of API price. `id` is what an index stores to pick it (`planReading`). */
export interface SubsidyReading { id: string; name: string; ratio: number; note: string }

/** Opus 5.5's share of API price on Claude Ultra, from Real API Pricing's measured row. The Fable 5.2 readings are multiples of it. */
const OPUS_ULTRA_SHARE = 0.015135;
const FABLE_READINGS: SubsidyReading[] = [
  {
    id: "shared", name: "Shared limit", ratio: OPUS_ULTRA_SHARE * 2.4267,
    note: "A Fable dollar priced at what it burns of the weekly limit it shares with Opus ($34.2 of Fable vs $14.1 of Opus per 1% of the week): 2.4x Opus' rate. Fable stops at half the limit.",
  },
  {
    id: "own", name: "Fable only", ratio: OPUS_ULTRA_SHARE * (3421 / 705),
    note: "Only the Fable a plan can buy: Fable stops at half the weekly limit, priced as if the other half went unused ($705 of Fable vs $3,421 of Opus a week): 4.9x Opus' rate.",
  },
];

export const SUBSIDY_OVERRIDES: SubsidyOverride[] = [
  {
    modelId: "aa-muse-wonder", label: "Muse Wonder (Max)", plan: "Command Code Max 10×", feeUsd: 100, ratio: 100 / 150, confidence: "medium", source: "https://commandcode.ai/pricing", checked: "2026-10-14",
    note: "Max includes $150 of credits, charged at the model's API rate with no markup: 1.5× the fee. Meta's own Muse Code plans publish prompts per 5 hours, not tokens or dollars, so they cannot be priced.",
    identity: { modelId: "aa-muse-wonder", modelName: "Muse Wonder (Max)", labId: "meta", effort: "max", variantId: "aa-muse-wonder@max", sourceModelId: "aa-muse-wonder", sourceSlug: "muse-wonder" },
  },
  // Fable 5.2 (released November 2026) has no adopted Real API Pricing row. Its share is a multiple of Opus 5.5's (1.5135% on Claude Ultra), read two
  // ways from the same account (FABLE_READINGS). The default, set by Adam on November 11, is the shared-limit reading: people don't spend a $200 plan
  // only on Fable, so a Fable dollar is priced at what it burns of the weekly limit. Real API Pricing's first sample (pull request 228, Claude Pro,
  // 7 points of the week) prices Fable 5.2 as if it could use the whole week; Fable is capped at half the week, so that row stays replaced until Real
  // API Pricing applies the cap. Revisit this entry when it does.
  {
    modelId: "claude-fable-5.2", label: "Claude Fable 5.2", plan: "Claude Ultra", feeUsd: 200, ratio: FABLE_READINGS[0].ratio, readings: FABLE_READINGS, confidence: "medium", source: "https://x.com/theo/status/2119960608816988596", checked: "2026-11-11",
    note: "Measured on one Max 20x (now Ultra) account, 1.1M requests through November 9, 2026. Fable 5.2 stops at half the weekly limit. Per 1% of the week, Fable burned $34.2 of API value and Opus 5.5 $14.1, so a Fable dollar uses 2.4 times as much of the shared limit: 2.4 times Opus 5.5's share of API price, the default. Counting only the Fable a plan can buy ($705 a week in its half, against $3,421 for a full week of Opus 5.5) gives 4.9 times, the other reading. Real API Pricing's first sample (Claude Pro, November 9) gives 2.5 and 5.1 times. A second Ultra account read 1.8 and 3.6 times, but it applied a banked Fable reset in its window, which made Fable look cheaper per point of the week, so it is not evidence for the rate.",
  },
];

/**
 * Models no plan sells yet, assumed to get another model's subsidy: the same share of API price, on the same
 * plan. Each row copies the other model's measured row and names the assumption in its plan. A measured row
 * for the model replaces it.
 */
export interface SubsidyAssumption {
  /** Canonical model id the assumption is for. */
  modelId: string;
  label: string;
  /** Canonical model id whose subsidy it borrows. */
  sameAs: string;
  /** Short name of that model, for the plan label. */
  sameAsName: string;
  /** Only these of the other model's plans (a model some plans don't sell). It is priced at the one with the biggest subsidy unless a visitor picks another. */
  plans?: RegExp;
  /** How much of the shared pool a list-price dollar of this model uses against one of the other model's (3: a third of its share of API price). Default 1. */
  poolRate?: number;
  /** Set once the assumption itself is measured; default "assumed". */
  confidence?: string;
  /** Replaces the model's measured row, which measured an allowance that no longer exists (Argon's own Pro pool, folded into the Gemini pool on 2026-11-23). */
  replaces?: true;
  /** The figure is early: shown wherever it appears. */
  preliminary?: PlanCaveat;
  /**
   * This model's own API list price (USD per 1M), when it differs from the other model's and no source lists it yet. With `plans`, the
   * plan's token price (what a dollar of plan buys) is kept and the share of API price is worked out against this price instead.
   */
  listPrice?: { input: number; cached: number; output: number };
  checked: string;
  note: string;
}

export const SUBSIDY_ASSUMPTIONS: SubsidyAssumption[] = [
  // GPT-6.2 Astra and Sol (OpenAI, 2026-11-17) have no plan measurement yet. Adam's call (November 17): assume each plan gives the same
  // tokens as the model it follows on ChatGPT plans, GPT-6 Astra and GPT-6.1 Sol, so the plan's token price carries over. Astra's API
  // price dropped (input and output 20%, cached input 60%), so the same tokens are a larger share of its new list price; Sol's price is
  // unchanged. A measured row for either replaces this the day it appears.
  {
    modelId: "gpt-6.2-astra", label: "GPT-6.2 Astra (max)", sameAs: "gpt-6-astra", sameAsName: "GPT-6 Astra", plans: /^ChatGPT /,
    listPrice: { input: 8, cached: 0.4, output: 40 }, checked: "2026-11-17",
    note: "No plan measurement for GPT-6.2 Astra yet: each ChatGPT plan is assumed to give as many tokens as it does for GPT-6 Astra, priced against GPT-6.2 Astra's lower API list price ($8 input, $0.40 cached, $40 output per 1M, from OpenAI's launch post), so its share of API price is higher than GPT-6 Astra's.",
  },
  {
    modelId: "gpt-6.2-sol", label: "GPT-6.2 Sol (max)", sameAs: "gpt-6.1-sol", sameAsName: "GPT-6.1 Sol", plans: /^ChatGPT /,
    listPrice: { input: 2, cached: 0.1, output: 10 }, checked: "2026-11-17",
    note: "No plan measurement for GPT-6.2 Sol yet: each ChatGPT plan is assumed to give as many tokens as it does for GPT-6.1 Sol, whose API prices GPT-6.2 Sol keeps ($2 input, $0.10 cached, $10 output per 1M).",
  },
  // Since 2026-11-23 every Gemini model on Antigravity draws on one Gemini pool on every paid plan: Varun Mohan (x.com/_mohansolo/status/2124960419429458207)
  // gave paid Pro users Carbon, and in the same thread ended Pro's separate Argon bucket, moving its capacity into the general Gemini bucket "so you
  // can also just use more Argon, Carbon, and (most importantly) Neon". agy states the pool is "consumed proportionally to the cost of the tokens",
  // and Flash, Hydrogen and Neon measure at the same rate per list-price dollar. Adam's call (November 23): Argon and Carbon get the same share of API
  // price as every other Google model. Until 2026-11-23 Carbon was Ultra-only at a third of Flash's share (a community reading of $600 of Flash or
  // $200 of Argon/Carbon a week on Ultra 5x), and Argon's Pro row measured its own small pool.
  {
    modelId: "gemini-4-carbon", label: "Gemini 4 Carbon (max)", sameAs: "gemini-3.8-flash", sameAsName: "Flash", checked: "2026-11-23",
    note: "Carbon draws on the Gemini pool every Google AI plan shares, Pro included since November 23, 2026, which is used in proportion to the API cost of the tokens, so it gets Flash's share of API price on whichever Google AI plan Flash is priced at, like Hydrogen.",
  },
  {
    modelId: "gemini-4", label: "Gemini 4 Argon (max)", sameAs: "gemini-3.8-flash", sameAsName: "Flash", replaces: true, checked: "2026-11-23",
    note: "Since November 23, 2026 Argon has no pool of its own on Google AI Pro: its capacity moved into the Gemini pool every plan shares, which is used in proportion to the API cost of the tokens, so Argon gets Flash's share of API price on each plan. Real API Pricing's Pro row for Argon measured the old separate pool.",
  },
  // Hydrogen shares the Gemini pool with Flash (agy's /quota lists both in "Gemini Models"; Pro's Argon pool is separate) and, measured
  // November 16, uses it at exactly Flash's rate per list-price dollar, so it gets Flash's share of API price on every plan. docs/data.md.
  {
    modelId: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen (xhigh)", sameAs: "gemini-3.8-flash", sameAsName: "Flash", confidence: "medium", checked: "2026-11-16",
    note: "Hydrogen draws on the same weekly Gemini pool as Gemini 3.8 Flash, and at the same rate per dollar of API list price: measured on November 16, 2026, Hydrogen used 0.165% to 0.166% of the weekly pool per dollar in five clean runs and Flash 0.167% in three, as Google's agy CLI states (\"Quota is consumed proportionally to the cost of the tokens\"). So Hydrogen gets Flash's share of API price on every plan. On Google AI Pro that share comes from three full weeks of Flash measurement (about $123 of API value a week; Real API Pricing issue 54): about 25 times the fee per four weeks.",
  },
];

/**
 * What real subscribers got from a plan, one row per person, plan and model: the tokens they used at API prices against the credits those tokens took. Add a row for each new data
 * point. `planUsageEstimates` scales each to a full allowance of the plan named, takes the median person, and labels the result preliminary with its sample size and everyone's source,
 * until a larger measurement or a Real API Pricing row replaces it.
 */
export interface PlanUsageSample {
  modelId: string;
  /** The label the build normalizes when no plan row exists for the model yet. */
  label: string;
  plan: string;
  feeUsd: number;
  /** API value of the tokens used, at `listPrice`. */
  apiUsd: number;
  /** How much of this plan's allowance those tokens take at the standard credit rate: 1 is all of it. */
  usedShare: number;
  listPrice: { cached: number; input: number; output: number; cacheWrite?: number };
  tokens: { cached: number; input: number; output: number; cacheWrite?: number };
  /** Who shared it, as they go by publicly. */
  by: string;
  /** Public post URL, omitted for data shared privately. */
  source?: string;
  /** Reference URL for reported API rates when `source` is omitted. */
  priceSource?: string;
  period: string;
  checked: string;
  /** Part of the usage could not be read, so the true figure is at least this. */
  atLeast?: boolean;
  /** Said on hover beside the figure, for what every reader should know. */
  caveat?: string;
  note?: string;
}

/** Published evidence that bears on a plan's figure but is not comparable enough to count in it. */
export interface PlanUsageContext { modelId: string; plan: string; by: string; source: string; note: string }

const QWEN_STANDARD = { plan: "Qwen Token Plan Standard", feeUsd: 18, checked: "2026-11-18" }, STANDARD_CREDITS = 80_000;
const QWEN_38_MAX = { ...QWEN_STANDARD, modelId: "qwen-3.8-max", label: "Qwen 3.8 Max (max)", listPrice: { cached: 0.25, input: 2, output: 6, cacheWrite: 2.5 }, caveat: "Usage from August 2026, rescaled to today's quotas." };
const NEON_BASE = {
  modelId: "gemini-4-neon", label: "Gemini 4 Neon (xhigh)", listPrice: { cached: 0.15, input: 3, output: 15 }, checked: "2026-11-18",
  priceSource: "https://www.testingcatalog.com/google-prepares-to-release-gemini-4-neon-model-on-apis/",
  caveat: "At reported $3/$15 API rates; 4-week monthly pool.",
};

export const PLAN_USAGE_SAMPLES: PlanUsageSample[] = [
  // Gemini 4 Neon: isolated agy CLI probes on Google AI Pro and Ultra 20x plus real ~95%-cached Pro usage (@Bolmercl),
  // November 18, 2026. Every probe ran a Gemini 3.8 Flash control on the same pool and matched 1.00x per list-price dollar ($105/wk on Pro,
  // also confirmed by two more Pro Flash controls from Pacote and an agy 1.5.12 run; $2,400/wk on Ultra 20x). Ultra 5x is extrapolated from 20x below.
  // Weekly pool deltas are divided by 4 to match Real API Pricing's 4-week monthly convention.
  {
    ...NEON_BASE, plan: "Google AI Pro", feeUsd: 19.99, apiUsd: 0.110001, usedShare: 0.001048 / 4,
    tokens: { cached: 0, input: 36_432, output: 47 }, by: "Ash", period: "November 18, 2026",
    note: "uncached gemini-4-neon-medium probe in agy CLI, 0.1048% of the weekly Gemini pool ($105/week, $30/5h); a Gemini 3.8 Flash control on the same account read $105/week (1.00x parity), also matched by two more Pro Flash controls ($105.0/week from Pacote and an agy 1.5.12 run)",
  },
  {
    ...NEON_BASE, plan: "Google AI Pro", feeUsd: 19.99, apiUsd: 33.70, usedShare: (0.71 * (33.70 / 72.91)) / 4,
    tokens: { cached: 88_260_400, input: 4_469_422, output: 470_178 }, by: "@Bolmercl", period: "November 18, 2026",
    note: "real-world 94.7%-cached usage (93.2M Neon tokens for $33.70 plus $39.21 of Gemini 4 Hydrogen, $72.91 combined across 71% of the weekly Gemini pool = $102.7/week; uncached input/output split inferred from $0.36/1M blended rate)",
  },
  {
    ...NEON_BASE, plan: "Google AI Ultra 20x", feeUsd: 199.99, apiUsd: 0.12798, usedShare: 0.0000532865524292 / 4,
    tokens: { cached: 0, input: 42_440, output: 44 }, by: "Pyrmi", period: "November 18, 2026",
    note: "uncached gemini-4-neon-high probe in agy CLI, 0.00533% of the weekly Gemini pool ($2,402/week, $600/5h); a Gemini 3.8 Flash control on the same account read $2,397/week (1.00x parity)",
  },
  // @SSHCodes used all 80,000 credits of the $18 plan with Qwen4-Max in T3 Code, 2,094 responses. 731.6M cached x $0.075 + 15.1M input x $1.50 + 2.26M output x $4.50 per 1M is $87.69
  // from the rounded counts; his logs give $87.76. Alibaba's plan page confirms $18 and 80,000 credits a month.
  {
    ...QWEN_STANDARD, modelId: "qwen-4-max", label: "Qwen 4 Max (max)", apiUsd: 87.76, usedShare: 1, listPrice: { cached: 0.075, input: 1.5, output: 4.5 },
    tokens: { cached: 731.6e6, input: 15.1e6, output: 2.26e6 }, by: "@SSHCodes", source: "https://x.com/SSHCodes/status/2123184045572096137", period: "November 15 to 16, 2026",
    note: "749M tokens over 2,094 responses in T3 Code, 98% of input cached, using all 80,000 of the plan's monthly credits",
  },
  // Qwen3.8-Max, August 2026, from the screenshots in each post: API value per credit at the standard rate, applied to today's 80,000-credit plan. Quotas were weekly and far smaller then,
  // so this assumes credits per token have not changed. $0.25 per 1M cached is from price trackers; Alibaba does not publish it. Research: ~/Projects/qwen-plan-subsidy-research/REPORT.md.
  {
    ...QWEN_38_MAX, apiUsd: 9.858515, usedShare: 5_000 / STANDARD_CREDITS, tokens: { cached: 6_805_823, input: 3_269_275, cacheWrite: 597_906, output: 20_624 }, by: "u/DertekAn",
    source: "https://www.reddit.com/r/Qwen_AI/comments/1vhv1z8/alibaba_blocked_me_for_saying_please_fix_your/", period: "August 6, 2026", note: "a full 2,500-credit Lite week at the 50% night rate, so 5,000 credits at the standard rate; 3.52 times the fee on the plan as it was then",
  },
  {
    ...QWEN_38_MAX, apiUsd: 17.580912, usedShare: 10_000 / STANDARD_CREDITS, tokens: { cached: 49_490_304, input: 1_897_824, output: 235_448 }, by: "u/Particular_Dingo_210",
    source: "https://www.reddit.com/r/Qwen_AI/comments/1vu9stj/qwen_standard_token_plan_usage_limits/", period: "August 17, 2026", note: "a full 10,000-credit Standard week; 4.19 times the fee as the plan was then, and 3.91 times today's if all of it ran at the night rate",
  },
  {
    ...QWEN_38_MAX, apiUsd: 3.884281, usedShare: 2_500 / STANDARD_CREDITS, atLeast: true, tokens: { cached: 6_974_483, input: 911_543, output: 52_929 }, by: "u/Weak_Lock_4076",
    source: "https://www.reddit.com/r/Qwen_AI/comments/1vhtr3m/wth_spent_my_week_quota_with_10m_token_for_qwen/", period: "August 6, 2026", note: "a full 2,500-credit Lite week with only the first day's tokens readable, so a floor; assumes no night discount",
  },
];

export const PLAN_USAGE_CONTEXT: PlanUsageContext[] = [
  {
    ...QWEN_STANDARD, modelId: "qwen-4-max", by: "mamaruo", source: "https://github.com/Fei2411/real-api-pricing/issues/240",
    note: "Not counted: mamaruo's Qwen4-Max-Preview usage works out to 3.89 times the fee at Standard's credits per dollar. It is a discounted preview on the China site, priced here at Qwen4-Max's API rates, and it retires November 25, 2026.",
  },
];

/** A preliminary plan figure scaled from another measured plan on the same model when no direct sample exists yet. */
export interface PlanUsageExtrapolation {
  modelId: string;
  fromPlan: string;
  plan: string;
  feeUsd: number;
  /** Allowance as a share of `fromPlan`'s (0.25 = 4x less usage). */
  usageFactor: number;
  label: string;
  note: string;
}

export const PLAN_USAGE_EXTRAPOLATIONS: PlanUsageExtrapolation[] = [
  {
    modelId: "gemini-4-neon",
    fromPlan: "Google AI Ultra 20x",
    plan: "Google AI Ultra 5x",
    feeUsd: 99.99,
    usageFactor: 0.25,
    label: "Extrapolated from 20x plan",
    note: "assumes 4x less usage than Google AI Ultra 20x at half the fee (half the subsidy)",
  },
];

export interface PlanUsageEstimate { modelId: string; label: string; plan: string; feeUsd: number; ratio: number; listPrice: PlanUsageSample["listPrice"]; source: string; checked: string; preliminary: PlanCaveat }

const times = (n: number) => `${n.toFixed(1)} times`;
/** One estimate per model and plan: the median person's API value for a full allowance, as a share paid of it. */
export function planUsageEstimates(samples: PlanUsageSample[] = PLAN_USAGE_SAMPLES, context: PlanUsageContext[] = PLAN_USAGE_CONTEXT, extrapolations: PlanUsageExtrapolation[] = PLAN_USAGE_EXTRAPOLATIONS): PlanUsageEstimate[] {
  const groups = new Map<string, PlanUsageSample[]>(), key = (s: { modelId: string; plan: string }) => `${s.modelId}|${s.plan}`;
  for (const s of samples) if (s.apiUsd > 0 && s.usedShare > 0 && s.feeUsd > 0) (groups.get(key(s)) ?? groups.set(key(s), []).get(key(s))!).push(s);
  const estimates: PlanUsageEstimate[] = [...groups.values()].map((list) => {
    const value = (s: PlanUsageSample) => s.apiUsd / s.usedShare / s.feeUsd, multiples = list.map(value).sort((a, b) => a - b), mid = multiples.length >> 1, multiple = multiples.length % 2 ? multiples[mid] : (multiples[mid - 1] + multiples[mid]) / 2;
    const first = list[0], people = [...new Set(list.map((s) => s.by))], who = people.join(", "), n = people.length, latest = list.map((s) => s.checked).sort().at(-1)!, caveat = [...new Set(list.flatMap((s) => s.caveat ?? []))].join(" "), related = context.filter((c) => key(c) === key(first));
    const source = first.source ?? first.priceSource ?? "";
    const base = `From ${n === 1 ? "one user's" : `${n} users'`} data (${who})`;
    const about = list.map((s) => `${s.by}: ${s.atLeast ? "at least " : ""}${times(value(s))}, ${s.period}${s.note ? ` (${s.note})` : ""}`).join("; ");
    return {
      modelId: first.modelId, label: first.label, plan: first.plan, feeUsd: first.feeUsd, ratio: 1 / multiple, listPrice: first.listPrice, source, checked: latest,
      preliminary: {
        label: `Preliminary, ${n} user${n === 1 ? "" : "s"}`, short: caveat ? `${base}. ${caveat} Pending larger-scale data.` : `${base}, pending larger-scale data.`,
        note: `${times(multiple)} the fee in API value${n > 1 ? `, the median of ${n} users` : ""}. ${about}. Results depend on each person's cache use.${related.length ? ` ${related.map((c) => c.note).join(" ")}` : ""}`,
        credit: who, ...(source ? { source } : {}), samples: n, sources: [...list.map((s) => ({ by: s.by, ...(s.source ? { url: s.source } : {}), counted: true })), ...related.map((c) => ({ by: c.by, url: c.source, counted: false }))],
      },
    };
  });
  for (const x of extrapolations) {
    if (estimates.some((e) => e.modelId === x.modelId && e.plan === x.plan)) continue;
    const base = estimates.find((e) => e.modelId === x.modelId && e.plan === x.fromPlan);
    if (!base) continue;
    const ratio = base.ratio * (x.feeUsd / base.feeUsd) / x.usageFactor, multiple = 1 / ratio;
    const baseCaveat = [...new Set((groups.get(key({ modelId: x.modelId, plan: x.fromPlan })) ?? []).flatMap((s) => s.caveat ?? []))].join(" ");
    estimates.push({
      modelId: base.modelId, label: base.label, plan: x.plan, feeUsd: x.feeUsd, ratio, listPrice: base.listPrice, source: base.source, checked: base.checked,
      preliminary: {
        label: x.label,
        short: `${x.label}${base.preliminary.credit ? ` (${base.preliminary.credit})` : ""}; ${x.note}.${baseCaveat ? ` ${baseCaveat}` : ""} Pending direct data.`,
        note: `${times(multiple)} the fee in API value, ${x.label.toLowerCase()} (${x.note}). Base reading on ${x.fromPlan}: ${base.preliminary.note}`,
        ...(base.preliminary.credit ? { credit: base.preliminary.credit } : {}),
        ...(base.source ? { source: base.source } : {}),
      },
    });
  }
  return estimates;
}

/**
 * Plan allowances changed after Real API Pricing measured them. A measurement taken before `until` saw the
 * old allowance, so its token price is multiplied by `factor` (old allowance ÷ new: 2 when halved, 0.5 when
 * doubled; same fee) and the plan is renamed to what it sells as now. A rename alone has factor 1 and no `until`: every
 * measurement takes the new name, whatever Real API Pricing still calls it.
 */
export interface PlanChange {
  /** Real API Pricing point id prefix (`<plan>::<model>`). */
  planId: string;
  plan: string;
  factor: number;
  until?: string;
  source: string;
  note: string;
}

export const PLAN_CHANGES: PlanChange[] = [
  {
    planId: "chatgpt_pro_5x", plan: "ChatGPT Pro 10x", factor: 0.5, until: "2026-10-29", source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro",
    note: "OpenAI doubled Pro 100's Work and Codex allowance on 29 October 2026: 5× to 10× Plus. The Pro 200 cut announced on 29 September was canceled the same day, so Pro 200 keeps the 20× allowance Real API Pricing measured.",
  },
  {
    planId: "claude_max_20x", plan: "Claude Ultra", factor: 1, source: "https://support.claude.com/en/articles/17728952-what-is-the-ultra-plan",
    note: "Anthropic renamed Max 20x to Ultra at the same $200, moving subscribers over with no price change. Its weekly allowance is 10 times Pro's, in line with the 10.33 times Real API Pricing measured under the old name, so the measurements stand.",
  },
];

/**
 * Plans no longer sold to new customers. Real API Pricing measured these allowances, and they still hold for existing
 * customers, so they stay priced but say so, and they leave the median while the lab sells something else. Cursor's replacements publish no token allowance
 * (cursor.com/docs/models-and-pricing, read 2026-11-04). Moonshot: "Andante, Moderato, Allegretto, and Allegro are legacy plans" (kimi.com/en/help/membership/membership-pricing, read 2026-11-05).
 */
// SuperGrok (Lite, $30, Plus, Heavy) gave way to the X Subscription on 2026-10-12 for new customers (PLAN_MULTIPLES below). "supergrok::" so the prefix does not match the other SuperGrok ids.
export const LEGACY_PLANS = ["cursor_", "kimi_andante", "kimi_moderato", "kimi_allegretto", "kimi_allegro", "supergrok::", "supergrok_lite", "supergrok_plus", "supergrok_heavy"];

/**
 * A lab's API price for a stated period, when Artificial Analysis lists the price that follows it and Real API Pricing publishes none.
 * A plan's share of API price uses this until `until`; then the row falls back on its own. Artificial Analysis' measured costs stay priced
 * at its own list, so the engine prices those at the plan's token price either way (`aaCostRatio` in `src/data/subscription.ts`).
 */
export interface ListPriceUntil { model: string; until: string; cached: number; input: number; output: number; source: string; checked: string }
export const LIST_PRICES_UNTIL: ListPriceUntil[] = [
  // "$2.00 through November 30, 2026", "$4.00 starting December 1, 2026"; output $10 then $20; caching $0.10 then $0.20.
  { model: "gemini-4-argon", until: "2026-12-01T00:00:00Z", cached: 0.1, input: 2, output: 10, source: "https://aistudio.google.com/docs/pricing", checked: "2026-11-05" },
];

/**
 * Plans a lab sells as a multiple of a base plan's allowance. A model measured on `base` but not on this plan
 * (or only at low confidence) gets it derived: base token price × (fee ÷ base fee) ÷ `multiple`, one grade less
 * confident. Real API Pricing derives its own Pro rows the same way ("Plus × 官方 5x").
 */
export interface PlanMultiple {
  /** Point id prefix of the measured plan. */
  base: string;
  planId: string;
  plan: string;
  feeUsd: number;
  /** Allowance as a multiple of `base`'s. */
  multiple: number;
  /** Listed so it can be picked and priced, but left out of the median a model is priced at by default. */
  listOnly?: boolean;
  /** Only models whose id matches: the plan does not include the others (or does not say how much of them). */
  models?: RegExp;
  source: string;
  checked: string;
}

export const PLAN_MULTIPLES: PlanMultiple[] = [
  { base: "chatgpt_plus", planId: "chatgpt_pro_5x", plan: "ChatGPT Pro 10x", feeUsd: 100, multiple: 10, source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", checked: "2026-10-29" },
  { base: "chatgpt_plus", planId: "chatgpt_pro_20x", plan: "ChatGPT Pro 20x", feeUsd: 200, multiple: 20, source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", checked: "2026-10-29" },
  // Launched 29 September 2026 at 25 times Plus; OpenAI doubled Pro 100 and Pro 500 on 29 October ("twice their previous Work and Codex allowance"), so 50 times. OpenAI states neither the launch figure nor 50 on the current page: 50 is that arithmetic.
  // The only self-serve plan with Ultrafast, which is why it is listed. Left out of the median so adding it moves no model's default price.
  { base: "chatgpt_plus", planId: "chatgpt_pro_500", plan: "ChatGPT Pro 500", feeUsd: 500, multiple: 50, listOnly: true, source: "https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers", checked: "2026-11-05" },
  // The X Subscription (2026-10-12) replaced SuperGrok: one weekly pool for Grok, Cursor and X, sold as Plus $8, Premium $30 (4x Plus), Super $100
  // (15x Plus) and Ultra $200 (50x Plus), from X's plans table (reported by @mattyp, November 23; the same prices are on Cursor's pricing page).
  // No one has measured it. Premium is "the benefits of SuperGrok, Cursor Pro, and X Premium+" at SuperGrok's $30, so it is assumed to give
  // SuperGrok's measured Grok allowance, and the others scale from it by X's multiples. Model-specific: only the Grok models SuperGrok was measured on.
  ...([["plus", "X Plus", 8, 1 / 4], ["premium", "X Premium", 30, 1], ["super", "X Super", 100, 15 / 4], ["ultra", "X Ultra", 200, 50 / 4]] as const).map(([id, plan, feeUsd, multiple]): PlanMultiple => ({
    base: "supergrok", planId: `xai_x_${id}`, plan, feeUsd, multiple, source: "https://cursor.com/docs/models-and-pricing", checked: "2026-11-23",
  })),
];

/**
 * Plans that sell a monthly budget in dollars, spent at the seller's own API rates, which Real API Pricing has not
 * measured. Each listed model gets a point the way Real API Pricing computes one: fee ÷ the tokens the budget buys at
 * the seller's rate, on the standard workload. On the seller's own models it is a first-party plan. On another lab's
 * model it is a reseller plan: the model's price when it has no first-party plan, and listed among its plans either
 * way, so it can be picked under Advanced → Plan. A Real API Pricing point with the same id replaces it.
 */
export interface BudgetPlan {
  /** Point id prefix (`<planId>::<model>`). */
  planId: string;
  plan: string;
  /** The seller, named as Real API Pricing names vendors: the plan is first-party on models of this vendor. */
  channel: string;
  feeUsd: number;
  /** Dollars of usage a month, at the models' rates. */
  budgetUsd: number;
  /**
   * A separate monthly output allowance, in the unit of `budgetUsd`, for plans that cap input and output apart (DeepRelay: 500M input
   * and 50M output tokens). Input and cache reads then spend `budgetUsd` and output spends this; whichever runs out first sets the tokens.
   */
  outputBudget?: number;
  confidence: "high" | "medium" | "low";
  source: string;
  checked: string;
  note: string;
  /** Our own measurement, newer than Real API Pricing's: its points replace theirs with the same id, instead of the other way round. */
  supersedes?: true;
  /** Listed beside a model's own plans, to pick under Advanced → Plan, but never the only row a model has (Devin Max next to GPT-6.2 Sol's assumed ChatGPT price). */
  listOnly?: true;
  /**
   * Each model's Real API Pricing slug and name, its vendor, and the seller's rate per 1M tokens (cache reads at 10% of input unless published).
   * Rates are in the unit of `budgetUsd`. A plan sold in credits gives both in credits, then `list` is the model's USD API price and `promo` the rates until a moment.
   */
  models: BudgetModel[];
}

export interface BudgetRates { input: number; cached?: number; output: number }
export interface BudgetModel extends BudgetRates {
  model: string; display: string; vendor: string;
  /** The figure for this model rests on something the seller does not publish: shown wherever it appears. */
  preliminary?: PlanCaveat;
  list?: { input: number; cached: number; output: number };
  promo?: BudgetRates & { until: string };
}

/** Tencent's Token Plan (intl): monthly credits with no rollover, spent at per-model credit rates. No five-hour or weekly limit is stated. */
const HY4_LIST = { input: 0.834, cached: 0.042, output: 2.501 };
const HY4_CREDITS = { input: 130.313, cached: 6.563, output: 390.781 };
const tencentTokenPlan = (tier: string, feeUsd: number, credits: number): BudgetPlan => ({
  planId: `tencent_token_plan_${tier.toLowerCase()}`, plan: `Tencent Token Plan ${tier}`, channel: "Tencent", feeUsd, budgetUsd: credits, confidence: "medium", source: "https://intl.cloud.tencent.com/document/product/1300/81315", checked: "2026-11-04",
  note: `${credits.toLocaleString("en-US")} credits a month, no rollover, spent at Tencent's credit rates per 1M tokens (intl.cloud.tencent.com/ind/document/product/1300/81316): 130.313 input, 390.781 output, 6.563 cached, about list price. Promotional rates apply until 12:00 Beijing time on 17 November 2026 for Hy4 (33, 98, 2) and 30 November for Hy4 preview (105, 215, 5).`,
  models: [
    { model: "hy4", display: "Hy4", vendor: "Tencent", ...HY4_CREDITS, list: HY4_LIST, promo: { until: "2026-11-17T04:00:00Z", input: 33, cached: 2, output: 98 } },
    { model: "hy4-preview", display: "Hy4 preview", vendor: "Tencent", ...HY4_CREDITS, list: HY4_LIST, promo: { until: "2026-11-30T04:00:00Z", input: 105, cached: 5, output: 215 } },
  ],
});

export const BUDGET_PLANS: BudgetPlan[] = [
  tencentTokenPlan("Lite", 7, 1000), tencentTokenPlan("Standard", 17, 2600), tencentTokenPlan("Pro", 51, 7900), tencentTokenPlan("Max", 103, 15900),
  {
    planId: "mistral_vibe_pro", plan: "Mistral Vibe Pro", channel: "Mistral", feeUsd: 14.99, budgetUsd: 300 + 15, confidence: "medium", source: "https://mistral.ai/pricing", checked: "2026-11-04",
    note: "$300 a month of Vibe usage at Mistral's API rates, the budget a Pro account shows (Mistral does not publish it; reported by SSHCodes on X, 29 October 2026), plus the $15 of API credits the pricing page lists for Pro ($25.50 is the student plan), spendable on the same models. Rates from docs.mistral.ai/models.",
    models: [
      { model: "mistral-medium-3.5", display: "Mistral Medium 3.5", vendor: "Mistral", input: 1.5, output: 7.5 },
      { model: "mistral-large-4", display: "Mistral Large 4", vendor: "Mistral", input: 0.7, cached: 0.07, output: 2.1 },
      { model: "mistral-large-3", display: "Mistral Large 3", vendor: "Mistral", input: 0.5, output: 1.5 },
      { model: "mistral-small-4", display: "Mistral Small 4", vendor: "Mistral", input: 0.15, output: 0.6 },
      { model: "glm-5.3", display: "GLM 5.3", vendor: "Zhipu", input: 1.4, cached: 0.14, output: 4.4 },
      { model: "glm-5.2", display: "GLM 5.2", vendor: "Zhipu", input: 1.4, cached: 0.14, output: 4.4 },
      { model: "glm-5.3-flash", display: "GLM 5.3 Flash", vendor: "Zhipu", input: 0.15, cached: 0.03, output: 0.5 },
      {
        model: "deepseek-v4.1-flash-1017", display: "DeepSeek V4.1 Flash 1017", vendor: "DeepSeek", input: 0.3, cached: 0.007, output: 1.2,
        preliminary: {
          label: "Preliminary", short: "Mistral does not publish the $300 Vibe budget (two reports on X), and DeepSeek on Vibe may hit the cache less often than DeepSeek's own API, which buys fewer tokens. Pending a measurement.",
          note: "$300 a month of Vibe usage plus $15 of API credits, at Mistral's rates for DeepSeek V4.1 Flash 1017. The budget is what Pro accounts show, not a published figure: SSHCodes (29 October 2026) and @yuhasbeentaken (19 November 2026), who warns that cache hit rates on Vibe can be much worse than on DeepSeek's own API. The standard workload assumes 97% cache reads; fewer hits spend the budget faster.",
          sources: [{ by: "SSHCodes", counted: true }, { by: "@yuhasbeentaken", url: "https://x.com/yuhasbeentaken/status/2123398659093995885", counted: true }],
        },
      },
    ],
  },
  // DeepRelay sells DeepSeek V4.1 Flash 1017 (and Kimi K3, GLM 5.3 and GLM 5.3 Flash at usage factors, not listed here) as token
  // allowances, input and output capped apart. Cached input counts as input. Checked on deeprelay.ai/pricing, 2026-11-19.
  ...([["Base", 0.99, 1], ["Plus", 4.99, 5]] as const).map(([tier, feeUsd, n]): BudgetPlan => ({
    planId: `deeprelay_${tier.toLowerCase()}`, plan: `DeepRelay ${tier}`, channel: "DeepRelay", feeUsd, budgetUsd: 500 * n, outputBudget: 50 * n, confidence: "medium", source: "https://deeprelay.ai/pricing", checked: "2026-11-19",
    note: `${500 * n}M input and ${50 * n}M output tokens a month (${125 * n}M and ${12.5 * n}M per rolling 7 days, which a month's use stays under), from deeprelay.ai/pricing. Cached input counts as input at the model's usage factor (1 for DeepSeek V4.1 Flash 1017), so on the standard workload, 97% cache reads, the input cap runs out first. Past a cap calls continue at pay-as-you-go rates. Budgets and rates here are in millions of tokens.`,
    models: [{ model: "deepseek-v4.1-flash-1017", display: "DeepSeek V4.1 Flash 1017", vendor: "DeepSeek", input: 1, cached: 1, output: 1 }],
  })),
  devinMax(),
];

/**
 * Devin Max ($200 a month) has only a weekly quota, shown in whole percents. Measured on 23 November 2026 (~/Projects/devin-quota): each model at
 * its lowest effort on unique short prompts, the dollars of Devin's listed API price spent between one-percent drops fitted per model. Budgets and
 * rates here are in percent of the weekly quota: 100 a week, 4.35 weeks a month, and each model's list price ÷ the dollars one percent buys (the
 * middle of the fitted range). Real API Pricing's Devin Max point for Opus 5.5 (23 September, 97% cache reads) gave 14 times the fee; this one
 * gives 2.7, so for both to hold Devin must count cache reads at well under the API's share of input, and cache-heavy work gets more than shown.
 */
function devinMax(): BudgetPlan {
  const rows: [string, string, string, { input: number; cached: number; output: number }, number, number][] = [
    ["gpt-6.2-sol", "GPT-6.2 Sol", "OpenAI", { input: 2, cached: 0.1, output: 10 }, 1.37, 1.71],
    ["claude-sonnet-5.5", "Claude Sonnet 5.5", "Anthropic", { input: 2, cached: 0.1, output: 10 }, 1.27, 1.48],
    ["claude-opus-5.5", "Claude Opus 5.5", "Anthropic", { input: 4, cached: 0.2, output: 20 }, 1.24, 1.26],
    ["claude-fable-5.2", "Claude Fable 5.2", "Anthropic", { input: 8, cached: 0.2, output: 40 }, 0.92, 1.38],
    ["claude-haiku-5.5", "Claude Haiku 5.5", "Anthropic", { input: 0.1, cached: 0.01, output: 0.5 }, 0.99, 1.15],
    ["gemini-4-neon", "Gemini 4 Neon", "Google", { input: 3, cached: 0.15, output: 15 }, 0.93, 1.08],
    ["muse-wonder", "Muse Wonder", "Muse", { input: 4, cached: 0.2, output: 20 }, 0.85, 1.04],
    ["gpt-6.2-astra", "GPT-6.2 Astra", "OpenAI", { input: 8, cached: 0.4, output: 40 }, 0.70, 1.16],
    ["gpt-6.1-terra", "GPT-6.1 Terra", "OpenAI", { input: 1, cached: 0.05, output: 5 }, 0.86, 1.29],
  ];
  return {
    planId: "devin_max", plan: "Devin Max", channel: "Cognition", feeUsd: 200, budgetUsd: 100 * 4.35, confidence: "medium", source: "https://devin.ai/pricing", checked: "2026-11-23", supersedes: true, listOnly: true,
    note: "A weekly quota, no daily cap, measured for Priors on 23 November 2026: dollars of Devin's listed API price per percent of the weekly quota, per model, at its lowest effort, on prompts that were mostly cache writes (counted at the input price) with almost no output. Output is assumed to count at the same share of list price as input. Each model saw one or two one-percent drops, so each figure is good to about 15%. DeepSeek V4.1 Flash dropped once in 14 runs, too few to measure, and is left out. GPT-6.1 Terra was measured the same day, after a first pass that skipped it. Budgets and rates here are in percent of the weekly quota.",
    models: rows.map(([model, display, vendor, list, lo, hi]) => {
      const perPercent = (lo + hi) / 2;
      return { model, display, vendor, list, input: list.input / perPercent, cached: list.cached / perPercent, output: list.output / perPercent };
    }),
  };
}
