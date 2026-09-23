import type { Effort, Lab } from "./types";

/**
 * Model identity normalization. Labels differ across sources
 * ("Opus 4.8 Adaptive Reasoning Max Effort", "opus-4.8 [max]", "Claude Opus 4.8 Thinking (max)").
 * We strip provider prefixes, punctuation, and effort words, then match against known
 * families. Anything unmatched is returned as `unknown` and excluded from ranking until
 * an alias is added to ALIASES below.
 */

export const LABS: Lab[] = [
  { id: "anthropic", name: "Anthropic", color: "#C96A4A" },
  { id: "openai", name: "OpenAI", color: "#2B2B2B" },
  { id: "google", name: "Google", color: "#3B78D8" },
  { id: "meta", name: "Meta", color: "#1F9E8A" },
  { id: "xai", name: "xAI", color: "#7B4FD8" },
  { id: "deepseek", name: "DeepSeek", color: "#2F4FB0" },
  { id: "alibaba", name: "Alibaba", color: "#B0409A" },
  { id: "moonshot", name: "Moonshot", color: "#5C8A2E" },
  { id: "mistral", name: "Mistral", color: "#E0742A" },
  { id: "zhipu", name: "Zhipu", color: "#8A8A80" },
  { id: "minimax", name: "MiniMax", color: "#D9A441" },
  { id: "xiaomi", name: "Xiaomi", color: "#8B5A33" },
  { id: "cognition", name: "Cognition", color: "#3A6B5E" },
  { id: "thinking-machines", name: "Thinking Machines", color: "#6B5B95" },
  { id: "tencent", name: "Tencent", color: "#2E7D9A" },
  { id: "cursor", name: "Cursor", color: "#444444" },
  { id: "ant-group", name: "Ant Group", color: "#A3A39B" },
  { id: "nvidia", name: "NVIDIA", color: "#A3A39B" },
  { id: "inception", name: "Inception", color: "#A3A39B" },
  { id: "poolside", name: "Poolside", color: "#A3A39B" },
  { id: "other", name: "Other", color: "#A3A39B" },
];

export const EFFORT_WORDS: Record<string, Effort> = {
  low: "low", minimal: "minimal", min: "minimal", none: "none",
  medium: "medium", med: "medium", mid: "medium", default: "medium",
  high: "high", hi: "high",
  xhigh: "xhigh", "x-high": "xhigh", "extra high": "xhigh", "extra-high": "xhigh", "very high": "xhigh",
  max: "max", maximum: "max", "max effort": "max", ultra: "max", xmax: "max",
};

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);

/** family regex -> canonical id + display name + lab. Order matters (most specific first). */
const FAMILIES: { re: RegExp; id: (m: RegExpMatchArray) => string; name: (m: RegExpMatchArray) => string; lab: string; reasoning?: boolean }[] = [
  // Anthropic
  { re: /\b(?:claude[\s-]*)?fable[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `claude-fable-${m[1]}`, name: (m) => `Fable ${m[1]}`, lab: "anthropic", reasoning: true },
  { re: /\b(?:claude[\s-]*)?opus[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `claude-opus-${m[1]}`, name: (m) => `Opus ${m[1]}`, lab: "anthropic", reasoning: true },
  { re: /\b(?:claude[\s-]*)?sonnet[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `claude-sonnet-${m[1]}`, name: (m) => `Sonnet ${m[1]}`, lab: "anthropic", reasoning: true },
  { re: /\b(?:claude[\s-]*)?haiku[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `claude-haiku-${m[1]}`, name: (m) => `Haiku ${m[1]}`, lab: "anthropic", reasoning: true },
  { re: /\b(?:claude[\s-]*)?mythos[\s-]*(preview)?\b/, id: () => "claude-mythos-preview", name: () => "Mythos Preview", lab: "anthropic", reasoning: true },
  // OpenAI
  { re: /\bgpt[\s-]*oss[\s-]*(\d+)b?\b/, id: (m) => `gpt-oss-${m[1]}b`, name: (m) => `gpt-oss-${m[1]}b`, lab: "openai", reasoning: true },
  { re: /\bgpt[\s-]*4o[\s-]*(mini)?\b/, id: (m) => `gpt-4o${m[1] ? "-mini" : ""}`, name: (m) => `GPT-4o${m[1] ? " mini" : ""}`, lab: "openai" },
  // codenamed variants (Sol/Luna/Terra/Astra...) and tiers are distinct models
  { re: /\bgpt[\s-]*(\d+(?:\.\d+)?)[\s-]*(mini|nano|pro|codex|sol|luna|terra|astra|chat|instant)(?:[\s-]+(mini|nano|pro|codex))?\b/, id: (m) => `gpt-${m[1]}-${m[2]}${m[3] ? "-" + m[3] : ""}`, name: (m) => `GPT-${m[1]} ${cap(m[2])}${m[3] ? " " + cap(m[3]) : ""}`, lab: "openai", reasoning: true },
  { re: /\bgpt[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `gpt-${m[1]}`, name: (m) => `GPT-${m[1]}`, lab: "openai", reasoning: true },
  { re: /\bo(\d)[\s-]*(mini|pro)?\b/, id: (m) => `o${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `o${m[1]}${m[2] ? " " + m[2] : ""}`, lab: "openai", reasoning: true },
  // Google
  { re: /\bgemma[\s-]*(\d+(?:\.\d+)?)[\s-]*(\d+(?:\.\d+)?)([bt])(?:[\s-]+(it|instruct))?\b/, id: (m) => `gemma-${m[1]}-${m[2]}${m[3]}${m[4] ? "-it" : ""}`, name: (m) => `Gemma ${m[1]} ${m[2]}${m[3].toUpperCase()}${m[4] ? " IT" : ""}`, lab: "google" },
  { re: /\bgemini[\s-]*(\d+(?:\.\d+)?)[\s-]*(pro|flash[\s-]*lite|flash|ultra)\b/, id: (m) => `gemini-${m[1]}-${m[2].replace(/\s+/g, "-")}`, name: (m) => `Gemini ${m[1]} ${m[2].replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ")}`, lab: "google", reasoning: true },
  { re: /\bgemini[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `gemini-${m[1]}`, name: (m) => `Gemini ${m[1]}`, lab: "google", reasoning: true },
  // xAI
  { re: /\bgrok[\s-]*build[\s-]*(\d+(?:\.\d+)?)?\b/, id: (m) => `grok-build${m[1] ? "-" + m[1] : ""}`, name: (m) => `Grok Build${m[1] ? " " + m[1] : ""}`, lab: "xai", reasoning: true },
  { re: /\bgrok[\s-]*(\d+(?:\.\d+)?)[\s-]*(mini|fast|heavy)?\b/, id: (m) => `grok-${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `Grok ${m[1]}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}`, lab: "xai", reasoning: true },
  // DeepSeek
  { re: /\bdeepseek[\s-]*v(\d+(?:\.\d+)?)[\s-]*(pro|flash|lite)[\s-]+(\d{4})\b/, id: (m) => `deepseek-v${m[1]}-${m[2]}-${m[3]}`, name: (m) => `DeepSeek V${m[1]} ${cap(m[2])} ${m[3]}`, lab: "deepseek", reasoning: true },
  { re: /\bdeepseek[\s-]*(?:v)?(\d+(?:\.\d+)?)[\s-]*(pro|lite|flash|chat)?\b/, id: (m) => `deepseek-v${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `DeepSeek V${m[1]}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}`, lab: "deepseek", reasoning: true },
  { re: /\bdeepseek[\s-]*r(\d+(?:\.\d+)?)\b/, id: (m) => `deepseek-r${m[1]}`, name: (m) => `DeepSeek R${m[1]}`, lab: "deepseek", reasoning: true },
  // Alibaba
  { re: /\bling[\s-]*(\d+(?:\.\d+)?)[\s-]*flash(?:[\s-]+(fin))?\b/, id: (m) => `ling-${m[1]}-flash${m[2] ? "-fin" : ""}`, name: (m) => `Ling ${m[1]} Flash${m[2] ? " Fin" : ""}`, lab: "ant-group" },
  { re: /\bqwen[\s-]*(\d+(?:\.\d+)?)[\s-]+(\d+(?:\.\d+)?)([bt])(?:[\s-]*a(\d+)([bt]))?\b/, id: (m) => `qwen-${m[1]}-${m[2]}${m[3]}${m[4] ? `-a${m[4]}${m[5]}` : ""}`, name: (m) => `Qwen ${m[1]} ${m[2]}${m[3].toUpperCase()}${m[4] ? `-A${m[4]}${m[5].toUpperCase()}` : ""}`, lab: "alibaba" },
  { re: /\bqwen[\s-]*(\d+(?:\.\d+)?)[\s-]*(max|plus|turbo|coder|flash)?\b/, id: (m) => `qwen-${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `Qwen ${m[1]}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}`, lab: "alibaba" },
  // Moonshot
  { re: /\bkimi[\s-]*k(\d+(?:\.\d+)?)[\s-]*(code|thinking|instruct)?\b/, id: (m) => `kimi-k${m[1]}${m[2] === "code" ? "-code" : ""}`, name: (m) => `Kimi K${m[1]}${m[2] === "code" ? " Code" : ""}`, lab: "moonshot", reasoning: true },
  // Mistral
  { re: /\bmercury[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `mercury-${m[1]}`, name: (m) => `Mercury ${m[1]}`, lab: "inception" },
  { re: /\blaguna[\s-]*(m|xs)[\s.-]*(\d+(?:\.\d+)?)\b/, id: (m) => `laguna-${m[1]}-${m[2]}`, name: (m) => `Laguna ${m[1].toUpperCase()}.${m[2]}`, lab: "poolside" },
  { re: /\b(mistral|magistral|devstral|codestral)[\s-]*(large|medium|small)?[\s-]*(\d+(?:\.\d+)?)?\b/, id: (m) => `${m[1]}${m[2] ? "-" + m[2] : ""}${m[3] ? "-" + m[3] : ""}`, name: (m) => `${m[1][0].toUpperCase()}${m[1].slice(1)}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}${m[3] ? " " + m[3] : ""}`, lab: "mistral" },
  // Zhipu
  { re: /\bglm[\s-]*(\d+(?:\.\d+)?)[\s-]*(air|flash|v)?\b/, id: (m) => `glm-${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `GLM ${m[1]}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}`, lab: "zhipu", reasoning: true },
  // MiniMax
  { re: /\bminimax[\s-]*m(\d+(?:\.\d+)?)\b/, id: (m) => `minimax-m${m[1]}`, name: (m) => `MiniMax M${m[1]}`, lab: "minimax", reasoning: true },
  // Xiaomi
  { re: /\bmimo[\s-]*(?:v)?(\d+(?:\.\d+)?)[\s-]*(pro|flash)?\b/, id: (m) => `mimo-v${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `MiMo V${m[1]}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}`, lab: "xiaomi", reasoning: true },
  // Meta
  { re: /\bnemotron[\s-]*(\d+(?:\.\d+)?)[\s-]*(ultra|lightning)\b/, id: (m) => `nemotron-${m[1]}-${m[2]}`, name: (m) => `Nemotron ${m[1]} ${cap(m[2])}`, lab: "nvidia" },
  { re: /\bmuse[\s-]*spark[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `muse-spark-${m[1]}`, name: (m) => `Muse Spark ${m[1]}`, lab: "meta", reasoning: true },
  { re: /\binkling(?:[\s-]*(small))?\b/, id: (m) => `inkling${m[1] ? "-small" : ""}`, name: (m) => `Inkling${m[1] ? " Small" : ""}`, lab: "thinking-machines", reasoning: true },
  { re: /\bhy[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `hy-${m[1]}`, name: (m) => `Hy${m[1]}`, lab: "tencent", reasoning: true },
  { re: /\bcomposer[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `composer-${m[1]}`, name: (m) => `Composer ${m[1]}`, lab: "cursor" },
  // Cognition's own SWE models (FrontierCode / FrontierSWE leaderboards)
  { re: /\bswe[\s-]*(\d+(?:\.\d+)?)\b/, id: (m) => `swe-${m[1]}`, name: (m) => `SWE ${m[1]}`, lab: "cognition", reasoning: true },
  { re: /\bllama[\s-]*(\d+(?:\.\d+)?)[\s-]*(maverick|scout|behemoth|\d+b)?\b/, id: (m) => `llama-${m[1]}${m[2] ? "-" + m[2] : ""}`, name: (m) => `Llama ${m[1]}${m[2] ? " " + m[2][0].toUpperCase() + m[2].slice(1) : ""}`, lab: "meta" },
];

/** Exact-label overrides for things the regexes cannot infer. lowercase label -> canonical id. */
export const ALIASES: Record<string, string> = {
  // Artificial Analysis uses the legacy "Claude <version> <tier>" ordering for pre-4.5 Anthropic models.
  "claude 3 haiku": "claude haiku 3",
  "claude 3 opus": "claude opus 3",
  "claude 3 sonnet": "claude sonnet 3",
  "claude 3.5 haiku": "claude haiku 3.5",
  "claude 3.5 sonnet june 24": "claude sonnet 3.5",
  "claude 3.5 sonnet oct 24": "claude sonnet 3.5",
  "claude 3.7 sonnet non-reasoning": "claude sonnet 3.7",
  "claude 3.7 sonnet reasoning": "claude sonnet 3.7",
  "claude 4 opus non-reasoning": "claude opus 4",
  "claude 4 opus reasoning": "claude opus 4",
  "claude 4 sonnet non-reasoning": "claude sonnet 4",
  "claude 4 sonnet reasoning": "claude sonnet 4",
  "claude 4.1 opus non-reasoning": "claude opus 4.1",
  "claude 4.1 opus reasoning": "claude opus 4.1",
  "claude 4.5 haiku non-reasoning": "claude haiku 4.5",
  "claude 4.5 haiku reasoning": "claude haiku 4.5",
  "claude 4.5 sonnet non-reasoning": "claude sonnet 4.5",
  "claude 4.5 sonnet reasoning": "claude sonnet 4.5",
  // Arena / ARC Prize / SimpleBench / BSBench / Harbor Hub label forms (hyphenated versions like
  // "claude-opus-4-6" would otherwise match Opus 4; "Claude 4.7" on arcprize.org is Opus 4.7; SimpleBench
  // lists Fable 5 as bare "Claude Fable", dated 2026-06-10).
  "claude 3.7 sonnet thinking": "claude sonnet 3.7",
  "claude 3.7 sonnet": "claude sonnet 3.7",
  "claude 4 opus": "claude opus 4",
  "claude 4 sonnet thinking": "claude sonnet 4",
  "claude 4.1 opus": "claude opus 4.1",
  "claude 4.5 sonnet": "claude sonnet 4.5",
  "claude 4.6 opus": "claude opus 4.6",
  "claude 4.7 high": "claude opus 4.7",
  "claude 4.7 low": "claude opus 4.7",
  "claude 4.7 max": "claude opus 4.7",
  "claude 4.7 medium": "claude opus 4.7",
  "claude fable": "claude fable 5",
  "claude-3-5-haiku-20241022": "claude haiku 3.5",
  "claude-3-5-sonnet-20240620": "claude sonnet 3.5",
  "claude-3-5-sonnet-20241022": "claude sonnet 3.5",
  "claude-3-7-sonnet-20250219": "claude sonnet 3.7",
  "claude-3-7-sonnet-20250219-thinking-32k": "claude sonnet 3.7",
  "claude-3-haiku": "claude haiku 3",
  "claude-3-haiku-20240307": "claude haiku 3",
  "claude-3-opus-20240229": "claude opus 3",
  "claude-3-sonnet-20240229": "claude sonnet 3",
  "claude-3.5-haiku": "claude haiku 3.5",
  "claude-3.5-sonnet": "claude sonnet 3.5",
  "claude-3.7-sonnet thinking": "claude sonnet 3.7",
  "claude-3.7-sonnet": "claude sonnet 3.7",
  "claude-haiku-4-5-20251001": "claude haiku 4.5",
  "claude-opus-4-1-20250805": "claude opus 4.1",
  "claude-opus-4-1-20250805-thinking-16k": "claude opus 4.1",
  "claude-opus-4-1-search": "claude opus 4.1",
  "claude-opus-4-5-20251101": "claude opus 4.5",
  "claude-opus-4-5-20251101-high-32k": "claude opus 4.5",
  "claude-opus-4-5-search": "claude opus 4.5",
  "claude-opus-4-6": "claude opus 4.6",
  "claude-opus-4-6-high": "claude opus 4.6",
  "claude-opus-4-6-search": "claude opus 4.6",
  "claude-opus-4-7": "claude opus 4.7",
  "claude-opus-4-7-high": "claude opus 4.7",
  "claude-opus-4-8": "claude opus 4.8",
  "claude-opus-4-8-high": "claude opus 4.8",
  "claude-sonnet-4-5-20250929": "claude sonnet 4.5",
  "claude-sonnet-4-5-20250929-high-32k": "claude sonnet 4.5",
  "claude-sonnet-4-5-search": "claude sonnet 4.5",
  "claude-sonnet-4-6": "claude sonnet 4.6",
  "claude-sonnet-4-6-search": "claude sonnet 4.6",
};

/** Exact public VALS catalog labels whose provider IDs resolve to known or explicit model identities. */
const VALS_PUBLISHED_MODELS: Record<string, { id: string; name: string; lab: string; reasoning: boolean }> = {
  "ling 3.0 flash": { id: "aa-ling-3-0-flash", name: "Ling 3.0 Flash", lab: "ant-group", reasoning: true },
  "ling 3.0 flash fin": { id: "aa-ling-3-0-flash-fin", name: "Ling 3.0 Flash Fin", lab: "ant-group", reasoning: true },
  "nemotron 3 ultra": { id: "aa-nvidia-nemotron-3-ultra-550b-a55b", name: "Nemotron 3 Ultra 550B A55B", lab: "nvidia", reasoning: true },
  "nemotron 3.5 lightning": { id: "aa-nemotron-3-5-lightning", name: "Nemotron 3.5 Lightning", lab: "nvidia", reasoning: true },
  "mercury 2.5": { id: "mercury-2.5", name: "Mercury 2.5", lab: "inception", reasoning: true },
  "laguna m.1": { id: "laguna-m-1", name: "Laguna M.1", lab: "poolside", reasoning: true },
  "laguna xs.2": { id: "laguna-xs-2", name: "Laguna XS.2", lab: "poolside", reasoning: true },
  "muse spark": { id: "aa-muse-spark", name: "Muse Spark", lab: "meta", reasoning: true },
  "claude 3.7 sonnet nonthinking": { id: "claude-sonnet-3.7", name: "Sonnet 3.7", lab: "anthropic", reasoning: true },
  "claude 3.5 haiku latest": { id: "claude-haiku-3.5", name: "Haiku 3.5", lab: "anthropic", reasoning: true },
  "command a": { id: "aa-command-a", name: "Command A", lab: "other", reasoning: true },
  "command r": { id: "aa-command-r-03-2024", name: "Command-R (Mar '24)", lab: "other", reasoning: true },
  "command r+": { id: "aa-command-r-plus-04-2024", name: "Command-R+ (Apr '24)", lab: "other", reasoning: true },
  "jamba 1.5 large": { id: "aa-jamba-1-5-large", name: "Jamba 1.5 Large", lab: "other", reasoning: true },
  "jamba 1.5 mini": { id: "aa-jamba-1-5-mini", name: "Jamba 1.5 Mini", lab: "other", reasoning: true },
  "jamba 1.6 large": { id: "aa-jamba-1-6-large", name: "Jamba 1.6 Large", lab: "other", reasoning: true },
  "jamba 1.6 mini": { id: "aa-jamba-1-6-mini", name: "Jamba 1.6 Mini", lab: "other", reasoning: true },
  "gemma 2 9b": { id: "gemma-2-9b", name: "Gemma 2 9B", lab: "google", reasoning: true },
  "gemma 2 27b": { id: "gemma-2-27b", name: "Gemma 2 27B", lab: "google", reasoning: true },
  "mixtral 8x7b": { id: "aa-mixtral-8x7b-instruct", name: "Mixtral 8x7B Instruct", lab: "mistral", reasoning: true },
  "alephprover": { id: "alephprover", name: "AlephProver", lab: "other", reasoning: false },
  "aristotle": { id: "aristotle", name: "Aristotle", lab: "other", reasoning: false },
};

export interface Normalized {
  ok: true;
  modelId: string;
  modelName: string;
  labId: string;
  effort?: Effort;
  reasoningFamily: boolean;
  cleaned: string;
}
export interface Unknown { ok: false; cleaned: string }

const NOISE = /\b(preview|latest|exp|experimental|chat|instruct|thinking|adaptive|reasoning|effort|reason|think|non[\s-]*thinking|no[\s-]*thinking|api|openrouter|via|by|new|beta|\d{4}-\d{2}-\d{2}|\d{8}|\d{4}-\d{2})\b/g;
const PROVIDER_PREFIX = /^(anthropic|openai|google|meta|meta-llama|xai|x-ai|deepseek|deepseek-ai|alibaba|qwen|moonshotai|moonshot|mistralai|mistral|zhipu|z-ai|thudm|minimax|minimaxai|xiaomi|cognition)\s*[/:]\s*/;

export function cleanLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(PROVIDER_PREFIX, "")
    .replace(/[_/]+/g, " ")
    .replace(/\((.*?)\)|\[(.*?)\]/g, " $1$2 ") // keep bracket contents as words
    .replace(/[^\w\s.-]/g, " ")
    .replace(/(\d)-(\d)(?!\d*[bk]\b)/g, "$1.$2") // "opus-4-6" -> "opus-4.6" (but keep 120b, 32k)
    .replace(/\s+/g, " ")
    .trim();
}

export function extractEffort(label: string): Effort | undefined {
  const l = label.toLowerCase();
  // bracketed or trailing effort words, longest first
  const keys = Object.keys(EFFORT_WORDS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp(`(?:^|[\\s\\[(:-])${k.replace(/[-\s]/g, "[\\s-]")}(?:[\\s\\])]|$|[\\s-]*(?:effort|reasoning|thinking))`, "i");
    if (re.test(l)) return EFFORT_WORDS[k];
  }
  return undefined;
}

export function normalizeLabel(label: string, effortHint?: string): Normalized | Unknown {
  const effort = (effortHint && EFFORT_WORDS[effortHint.toLowerCase().trim()]) || extractEffort(label);
  let cleaned = cleanLabel(label);
  const valsModel = VALS_PUBLISHED_MODELS[label.toLowerCase().trim()] ?? VALS_PUBLISHED_MODELS[cleaned];
  if (valsModel) return {
    ok: true,
    modelId: valsModel.id,
    modelName: valsModel.name,
    labId: valsModel.lab,
    effort,
    reasoningFamily: valsModel.reasoning,
    cleaned,
  };
  const alias = ALIASES[cleaned] ?? ALIASES[label.toLowerCase().trim()];
  const stripped = cleaned.replace(NOISE, " ").replace(/\s+/g, " ").trim();
  cleaned = stripped;
  const target = alias ?? stripped;
  const effortRe = new RegExp(`\\b(${Object.keys(EFFORT_WORDS).join("|")})\\b`, "i");
  for (const f of FAMILIES) {
    const m = target.match(f.re);
    if (m) {
      // if the family pattern consumed the effort word (e.g. "Qwen 3.7 Max"), it's a tier, not an effort
      const consumedEffort = effortRe.test(m[0]);
      return { ok: true, modelId: f.id(m), modelName: f.name(m), labId: f.lab, effort: consumedEffort ? (effortHint ? extractEffort(effortHint) : extractEffort(target.slice((m.index ?? 0) + m[0].length))) : effort, reasoningFamily: !!f.reasoning, cleaned };
    }
  }
  return { ok: false, cleaned };
}

export function variantId(modelId: string, effort: Effort) {
  return `${modelId}@${effort}`;
}
