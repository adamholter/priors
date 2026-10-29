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
 * Plan allowances cut after Real API Pricing measured them. A measurement taken before `until` saw the
 * old allowance, so its token price is multiplied by `factor` (same fee, fewer tokens) and the plan is
 * renamed to what it sells as now.
 */
export interface PlanCut {
  /** Real API Pricing point id prefix (`<plan>::<model>`). */
  planId: string;
  plan: string;
  factor: number;
  until: string;
  source: string;
  note: string;
}

export const PLAN_CUTS: PlanCut[] = [
  {
    planId: "chatgpt_pro_20x", plan: "ChatGPT Pro 10x", factor: 2, until: "2026-10-30", source: "https://chatgpt.com/pricing",
    note: "OpenAI cut Pro $200 from 20× to 10× Plus usage: new sign-ups from 29 September 2026, grandfathered subscribers from 30 October. Plus, Pro $100 and Pro $200 are now linear per dollar.",
  },
];
