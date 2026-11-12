import type { RawRow } from "../../../src/data/types";

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
    note: "Measured on one Max 20x (now Ultra) account, 1.1M requests through November 9, 2026. Fable 5.2 stops at half the weekly limit. Per 1% of the week, Fable burned $34.2 of API value and Opus 5.5 $14.1, so a Fable dollar uses 2.4 times as much of the shared limit: 2.4 times Opus 5.5's share of API price, the default. Counting only the Fable a plan can buy ($705 a week in its half, against $3,421 for a full week of Opus 5.5) gives 4.9 times, the other reading. A second Ultra account gives 1.8 and 3.6 times; Real API Pricing's first sample (Claude Pro, November 9) gives 2.5 and 5.1 times.",
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
  checked: string;
  note: string;
}

export const SUBSIDY_ASSUMPTIONS: SubsidyAssumption[] = [
  {
    modelId: "gemini-4-carbon", label: "Gemini 4 Carbon (max)", sameAs: "gemini-4", sameAsName: "Argon", checked: "2026-10-29",
    note: "No plan sells Carbon yet: Google opened it to cyber defenders first, with subscribers \"coming soon\". Assumed to get Argon's subsidy on the same plan.",
  },
  // Released November 12, 2026. Adam: assume Flash's or Argon's subsidy, Argon's when they differ. They do: Gemini 3.8 Flash's measured share of API price is a fraction of Argon's.
  {
    modelId: "gemini-4-hydrogen", label: "Gemini 4 Hydrogen (xhigh)", sameAs: "gemini-4", sameAsName: "Argon", checked: "2026-11-12",
    note: "Released November 12, 2026, before Real API Pricing has measured it on a plan. Assumed to get Argon's subsidy on the same plan.",
  },
];

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
export const LEGACY_PLANS = ["cursor_", "kimi_andante", "kimi_moderato", "kimi_allegretto", "kimi_allegro"];

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
  source: string;
  checked: string;
}

export const PLAN_MULTIPLES: PlanMultiple[] = [
  { base: "chatgpt_plus", planId: "chatgpt_pro_5x", plan: "ChatGPT Pro 10x", feeUsd: 100, multiple: 10, source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", checked: "2026-10-29" },
  { base: "chatgpt_plus", planId: "chatgpt_pro_20x", plan: "ChatGPT Pro 20x", feeUsd: 200, multiple: 20, source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", checked: "2026-10-29" },
  // Launched 29 September 2026 at 25 times Plus; OpenAI doubled Pro 100 and Pro 500 on 29 October ("twice their previous Work and Codex allowance"), so 50 times. OpenAI states neither the launch figure nor 50 on the current page: 50 is that arithmetic.
  // The only self-serve plan with Ultrafast, which is why it is listed. Left out of the median so adding it moves no model's default price.
  { base: "chatgpt_plus", planId: "chatgpt_pro_500", plan: "ChatGPT Pro 500", feeUsd: 500, multiple: 50, listOnly: true, source: "https://help.openai.com/en/articles/9793128-about-chatgpt-pro-tiers", checked: "2026-11-05" },
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
  confidence: "high" | "medium" | "low";
  source: string;
  checked: string;
  note: string;
  /**
   * Each model's Real API Pricing slug and name, its vendor, and the seller's rate per 1M tokens (cache reads at 10% of input unless published).
   * Rates are in the unit of `budgetUsd`. A plan sold in credits gives both in credits, then `list` is the model's USD API price and `promo` the rates until a moment.
   */
  models: BudgetModel[];
}

export interface BudgetRates { input: number; cached?: number; output: number }
export interface BudgetModel extends BudgetRates {
  model: string; display: string; vendor: string;
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
      { model: "deepseek-v4.1-flash-1017", display: "DeepSeek V4.1 Flash 1017", vendor: "DeepSeek", input: 0.3, cached: 0.007, output: 1.2 },
    ],
  },
];
