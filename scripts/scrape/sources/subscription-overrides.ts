import type { RawRow } from "../../../src/data/types";

/**
 * Subsidy figures read straight from a published plan allowance, for models Real API Pricing does not
 * cover. `ratio` is what a subscriber pays as a share of API list price at full use (fee ÷ usage value),
 * so 6× subsidized is 1/6. Free tiers are not listed here: `scripts/scrape/free-tiers.ts` reads them live from OpenCode Zen and OpenRouter. Only figures at roughly 80% confidence or better belong here: a plan page that
 * states the allowance in dollars of usage, checked on `checked`. Each replaces any computed row for the model.
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
}

export const SUBSIDY_OVERRIDES: SubsidyOverride[] = [
  {
    modelId: "aa-muse-wonder", label: "Muse Wonder (Max)", plan: "Command Code Max 10×", feeUsd: 100, ratio: 100 / 150, confidence: "medium", source: "https://commandcode.ai/pricing", checked: "2026-10-14",
    note: "Max includes $150 of credits, charged at the model's API rate with no markup: 1.5× the fee. Meta's own Muse Code plans publish prompts per 5 hours, not tokens or dollars, so they cannot be priced.",
    identity: { modelId: "aa-muse-wonder", modelName: "Muse Wonder (Max)", labId: "meta", effort: "max", variantId: "aa-muse-wonder@max", sourceModelId: "aa-muse-wonder", sourceSlug: "muse-wonder" },
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
];

/**
 * Plan allowances changed after Real API Pricing measured them. A measurement taken before `until` saw the
 * old allowance, so its token price is multiplied by `factor` (old allowance ÷ new: 2 when halved, 0.5 when
 * doubled; same fee) and the plan is renamed to what it sells as now.
 */
export interface PlanChange {
  /** Real API Pricing point id prefix (`<plan>::<model>`). */
  planId: string;
  plan: string;
  factor: number;
  until: string;
  source: string;
  note: string;
}

export const PLAN_CHANGES: PlanChange[] = [
  {
    planId: "chatgpt_pro_5x", plan: "ChatGPT Pro 10x", factor: 0.5, until: "2026-10-29", source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro",
    note: "OpenAI doubled Pro 100's Work and Codex allowance on 29 October 2026: 5× to 10× Plus. The Pro 200 cut announced on 29 September was canceled the same day, so Pro 200 keeps the 20× allowance Real API Pricing measured.",
  },
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
  source: string;
  checked: string;
}

export const PLAN_MULTIPLES: PlanMultiple[] = [
  { base: "chatgpt_plus", planId: "chatgpt_pro_5x", plan: "ChatGPT Pro 10x", feeUsd: 100, multiple: 10, source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", checked: "2026-10-29" },
  { base: "chatgpt_plus", planId: "chatgpt_pro_20x", plan: "ChatGPT Pro 20x", feeUsd: 200, multiple: 20, source: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", checked: "2026-10-29" },
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
  /** Each model's Real API Pricing slug and name, its vendor, and the seller's API price per 1M tokens (cache reads at 10% of input unless published). */
  models: { model: string; display: string; vendor: string; input: number; cached?: number; output: number }[];
}

export const BUDGET_PLANS: BudgetPlan[] = [
  {
    planId: "mistral_vibe_pro", plan: "Mistral Vibe Pro", channel: "Mistral", feeUsd: 14.99, budgetUsd: 300 + 25.5, confidence: "medium", source: "https://mistral.ai/pricing", checked: "2026-10-29",
    note: "$300 a month of Vibe usage at Mistral's API rates, the budget a Pro account shows (Mistral does not publish it; reported by SSHCodes on X, 29 October 2026), plus the $25.50 of API credits the pricing page lists, spendable on the same models. Rates from docs.mistral.ai/models.",
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
