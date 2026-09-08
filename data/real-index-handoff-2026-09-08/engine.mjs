// src/data/reasoningProfiles.json
var reasoningProfiles_default = {
  "gemini-3-1-pro-preview": {
    sourceUrl: "https://ai.google.dev/gemini-api/docs/generate-content/thinking",
    basis: "documented-settings",
    configurations: [
      { tier: "top", effort: "high" },
      { tier: "middle", effort: "medium" },
      { tier: "lowest", effort: "low" }
    ]
  },
  "gpt-6-astra-max": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/gpt-6-astra",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "gpt-5-6-terra": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/gpt-5-6-terra",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "gpt-5-6-luna-max": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/gpt-5-6-luna",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "gpt-5-6-sol-max": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/gpt-5-6-sol",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "claude-opus-5-max": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/claude-opus-5",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "claude-fable-5-1-max": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/claude-fable-5-1",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "gemini-3-8-flash-high": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/gemini-3-8-flash",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "high"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "grok-4-6-high": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/grok-4-6",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "high"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "muse-spark-1-3-xhigh": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/muse-spark-1-3",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "lowest",
        effort: "xhigh"
      }
    ]
  },
  "kimi-k3-max": {
    sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "qwen3-8-27b": {
    sourceUrl: "https://artificialanalysis.ai/models/releases/qwen3-8-27b",
    basis: "shared-benchmarks",
    configurations: [
      {
        tier: "top",
        effort: "xhigh"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "glm-5-3-max": {
    sourceUrl: "https://huggingface.co/zai-org/GLM-5.3",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "glm-5-3-flash": {
    sourceUrl: "https://huggingface.co/zai-org/GLM-5.3-Flash",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "deepseek-v4-pro-max": {
    sourceUrl: "https://api-docs.deepseek.com/guides/thinking_mode/",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "deepseek-v4-flash-0731": {
    sourceUrl: "https://api-docs.deepseek.com/guides/thinking_mode/",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "max"
      },
      {
        tier: "middle",
        effort: "high"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "qwen3-8-max": {
    sourceUrl: "https://docs.qwencloud.com/api-reference/chat/openai-chat",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "xhigh"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "qwen3-8-max-0902": {
    sourceUrl: "https://docs.qwencloud.com/api-reference/chat/openai-chat",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "xhigh"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "qwen3-8-flash-next": {
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-Flash-Next",
    basis: "documented-settings",
    configurations: [
      {
        tier: "top",
        effort: "xhigh"
      },
      {
        tier: "middle",
        effort: "medium"
      },
      {
        tier: "lowest",
        effort: "low"
      }
    ]
  },
  "minimax-m3": {
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    basis: "single",
    configurations: [
      {
        tier: "single",
        effort: null
      }
    ]
  }
};

// src/data/models.ts
var modelCatalog = [
  {
    id: "gemini-3-1-pro-preview",
    visionInput: "supported",
    visionSourceUrl: "https://deepmind.google/models/model-cards/gemini-3-1-pro/",
    name: "Gemini 3.1 Pro Preview",
    shortName: "Gemini 3.1 Pro",
    organization: "Google",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-02-19",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Google multimodal reasoning model; API identifier gemini-3.1-pro-preview. Low, medium and high thinking settings remain distinct."
  },
  {
    id: "qwen3-8-max-0902",
    visionInput: "supported",
    visionSourceUrl: "https://www.qwencloud.com/models/qwen3.8-max-0902",
    name: "Qwen3.8-Max-0902",
    shortName: "Qwen3.8-Max-0902",
    organization: "Alibaba",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-09-02",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "September 2 snapshot, also identified as qwen3.8-max-2026-09-02. Further post-trained for coding and collaborative work, with native image and video input. Only results established for this snapshot are included."
  },
  {
    id: "glm-5-3-flash",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    name: "GLM 5.3 Flash",
    shortName: "GLM 5.3 Flash",
    organization: "Z AI",
    access: "open_weights",
    license: "Mit",
    releaseDate: "2026-08-26",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Scores use compatible results for the displayed reasoning configuration. Includes sourced primary and fallback benchmark measurements."
  },
  {
    id: "qwen3-8-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    name: "Qwen3.8 Max (2026-08-03)",
    shortName: "Qwen3.8 Max (2026-08-03)",
    organization: "Alibaba",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-08-03",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Scores use compatible results for the displayed reasoning configuration. Original August 3 API release, distinct from Max 0902 and standalone open weights."
  },
  {
    id: "qwen3-8-flash-next",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    name: "Qwen3.8-Flash-Next",
    shortName: "Qwen3.8-Flash-Next",
    organization: "Alibaba",
    access: "open_weights",
    license: "Qwen Community License 1.0",
    releaseDate: "2026-08-26",
    contextWindow: 256000,
    isReasoningModel: true,
    description: "Scores use compatible results for the displayed reasoning configuration. Open-weight Flash-Next release, kept separate from hosted Qwen3.8 Flash."
  },
  {
    id: "deepseek-v4-flash-0731",
    visionInput: "unsupported",
    visionSourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    name: "DeepSeek V4 Flash 0731",
    shortName: "DeepSeek V4 Flash 0731",
    organization: "DeepSeek",
    access: "open_weights",
    license: "Mit",
    releaseDate: "2026-07-31",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Scores use compatible results for the displayed reasoning configuration. July 31 text-only release; distinct from preview and experimental vision variants."
  },
  {
    id: "gpt-5-6-terra",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    name: "GPT-5.6 Terra",
    shortName: "GPT-5.6 Terra",
    organization: "OpenAI",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-07-09",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Scores use compatible results for the displayed reasoning configuration. Includes sourced primary and fallback benchmark measurements."
  },
  {
    id: "minimax-m3",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    name: "MiniMax-M3",
    shortName: "MiniMax-M3",
    organization: "MiniMax",
    access: "open_weights",
    license: "MINIMAX COMMUNITY LICENSE",
    releaseDate: "2026-06-01",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Scores use compatible results for the displayed reasoning configuration. Includes sourced primary and fallback benchmark measurements."
  },
  {
    id: "qwen3-8-27b",
    visionInput: "supported",
    visionSourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    name: "Qwen 3.8 27B",
    shortName: "Qwen 3.8 27B",
    organization: "Alibaba",
    access: "open_weights",
    license: "Apache 2.0",
    releaseDate: "2026-08-14",
    contextWindow: 262144,
    isReasoningModel: true,
    description: "Dense 27B open-weight reasoning model with native image and video input, tool use, and adjustable reasoning effort. Scores use compatible results for the displayed reasoning configuration."
  },
  {
    id: "claude-fable-5-1-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "Claude Fable 5.1 (with fallback)",
    shortName: "Claude Fable 5.1",
    organization: "Anthropic",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-08-14",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Anthropic frontier model featuring dynamic adaptive reasoning loops, agentic scaffolding, and state-of-the-art software engineering comprehension.",
    badge: "Frontier #1"
  },
  {
    id: "claude-opus-5-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "Claude Opus 5",
    shortName: "Claude Opus 5",
    organization: "Anthropic",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-06-20",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "Anthropic heavyweight reasoning model with high-effort deliberation across multidisciplinary science, math, and long-context architecture.",
    badge: "Deep Reasoning"
  },
  {
    id: "gpt-6-astra-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "GPT-6 Astra",
    shortName: "GPT-6 Astra",
    organization: "OpenAI",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-08-28",
    contextWindow: 1050000,
    isReasoningModel: true,
    description: "OpenAI flagship multimodal intelligence system with advanced unified planning, scientific hypothesis generation, and autonomous terminal execution.",
    badge: "Flagship"
  },
  {
    id: "grok-4-6-high",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "Grok 4.6",
    shortName: "Grok 4.6",
    organization: "SpaceX",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-07-15",
    contextWindow: 500000,
    isReasoningModel: true,
    description: "xAI high-compute reasoning model trained on real-time data feeds with strong STEM verification and a 500K token context window."
  },
  {
    id: "muse-spark-1-3-xhigh",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "Muse Spark 1.3",
    shortName: "Muse Spark 1.3",
    organization: "Muse AI",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-07-22",
    contextWindow: 1048576,
    isReasoningModel: true,
    description: "High-throughput reasoning model combining high token generation speed with extended chain-of-thought problem solving."
  },
  {
    id: "kimi-k3-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "Kimi K3",
    shortName: "Kimi K3",
    organization: "Moonshot AI",
    access: "open_weights",
    license: "Kimi K3 License",
    releaseDate: "2026-06-10",
    contextWindow: 1048576,
    isReasoningModel: true,
    description: "Moonshot AI ultra-long context reasoning model specializing in exhaustive codebase analysis and repository-level question answering."
  },
  {
    id: "glm-5-3-max",
    visionInput: "unsupported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "GLM-5.3",
    shortName: "GLM-5.3",
    organization: "Zhipu AI",
    access: "open_weights",
    license: "GLM-5.3 License",
    releaseDate: "2026-07-02",
    contextWindow: 1048576,
    isReasoningModel: true,
    description: "Bilingual frontier model featuring enhanced tool execution, autonomous terminal workflows, and scientific mathematics."
  },
  {
    id: "gemini-3-8-flash-high",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "Gemini 3.8 Flash",
    shortName: "Gemini 3.8 Flash",
    organization: "Google",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-06-25",
    contextWindow: 1048576,
    isReasoningModel: true,
    description: "Ultra-fast multimodal reasoning model delivering over 320 tokens/sec throughput with native audio/visual grounding and a 1M token context window.",
    badge: "Speed King"
  },
  {
    id: "deepseek-v4-pro-max",
    visionInput: "unsupported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "DeepSeek V4 Pro 0813",
    shortName: "DeepSeek V4 Pro",
    organization: "DeepSeek",
    access: "open_weights",
    license: "MIT",
    releaseDate: "2026-08-13",
    contextWindow: 1e6,
    isReasoningModel: true,
    description: "DeepSeek next-gen sparse MoE model with native multi-token prediction, advanced agentic terminal skills, and economical inference costs.",
    badge: "Efficiency Leader"
  },
  {
    id: "gpt-5-6-luna-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "GPT-5.6 Luna",
    shortName: "GPT-5.6 Luna",
    organization: "OpenAI",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-05-18",
    contextWindow: 1050000,
    isReasoningModel: true,
    description: "Ultra-economical OpenAI model delivering high reasoning capabilities at under $0.05 per standard task, setting the budget frontier.",
    badge: "Ultra Low Cost"
  },
  {
    id: "gpt-5-6-sol-max",
    visionInput: "supported",
    visionSourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    name: "GPT-5.6 Sol",
    shortName: "GPT-5.6 Sol",
    organization: "OpenAI",
    access: "api",
    license: "Proprietary API",
    releaseDate: "2026-07-09",
    contextWindow: 1050000,
    isReasoningModel: true,
    description: "OpenAI reasoning model evaluated with tool-augmented workflows across coding and visual reasoning benchmarks.",
    badge: "Tool Reasoning"
  }
];
var reasoningProfiles = reasoningProfiles_default;
var tierLabels = { top: "Top", middle: "Middle", lowest: "Lowest", single: "Single configuration" };
var initialModels = modelCatalog.flatMap((model) => {
  const profile = reasoningProfiles[model.id];
  return profile.configurations.map((config) => ({
    ...model,
    id: config.tier === "top" || config.tier === "single" ? model.id : `${model.id}--${String(config.effort)}`,
    name: `${model.name} — ${tierLabels[config.tier]}`,
    shortName: `${model.shortName} — ${tierLabels[config.tier]}`,
    reasoningConfiguration: { ...config, releaseId: model.id, sourceUrl: profile.sourceUrl, basis: profile.basis }
  }));
});
// src/data/qwenObservations.ts
var qwenObservations = [
  {
    modelId: "qwen3-8-27b",
    metricId: "tau3-banking",
    value: 48.041237113402104,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "terminal-bench-2-1",
    value: 79.7752808988764,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "scicode",
    value: 46.6435185185185,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-lcr",
    value: 82,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "hle",
    value: 33.920296570899,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "critpt",
    value: 5.42857142857143,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "mmmu-pro",
    value: 76.3005780346821,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "enterprise-ops-gym-aa",
    value: 44.225604297224706,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience",
    value: -9.98333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Published index on the -100 to 100 scale.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience-accuracy",
    value: 15.583333333333332,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Accuracy fraction converted to percent.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience-hallucination-rate",
    value: 30.286278381046394,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Hallucination-rate fraction converted to percent; lower is better.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-briefcase",
    value: 1404.14,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "AA Stirrup; AA-Briefcase combined Elo",
    notes: "Published combined Elo, not rubric pass rate.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "output-speed",
    value: 44.0014038122235,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis first-party Alibaba API performance",
    notes: "Median output throughput; not local hardware throughput.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "time-to-first-answer-token",
    value: 49.3945452945738,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis first-party Alibaba API performance",
    notes: "Includes reasoning time; not time to first chunk.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "time-per-task",
    value: 966.1944867750528,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis Intelligence Index v4.2",
    notes: "Weighted decode seconds per task, excluding TTFT and overhead; not wall-clock computer-use time.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "cost-per-task",
    value: 0.5727355343819633,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis Intelligence Index v4.2",
    notes: "Weighted cost per index task including published cache accounting.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "tau3-banking",
    value: 47.4226804123711,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "terminal-bench-2-1",
    value: 65.1685393258427,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "scicode",
    value: 39.0046296296296,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-lcr",
    value: 79.6666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "hle",
    value: 14.0871177015755,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "critpt",
    value: 0,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "mmmu-pro",
    value: 74.1618497109827,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience",
    value: -36.15,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Published index on the -100 to 100 scale.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience-accuracy",
    value: 18.35,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Accuracy fraction converted to percent.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience-hallucination-rate",
    value: 66.74831598285364,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Hallucination-rate fraction converted to percent; lower is better.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "output-speed",
    value: 52.7708424419091,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis first-party Alibaba API performance",
    notes: "Median output throughput; not local hardware throughput.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "time-to-first-answer-token",
    value: 41.7790760621203,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis first-party Alibaba API performance",
    notes: "Includes reasoning time; not time to first chunk.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "tau3-banking",
    value: 32.1649484536082,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "terminal-bench-2-1",
    value: 67.4157303370786,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "scicode",
    value: 40.046296296296305,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-lcr",
    value: 77.3333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "hle",
    value: 14.040778498609798,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "critpt",
    value: 0,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "mmmu-pro",
    value: 73.757225433526,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact Qwen3.8 27B release and published effort. Fractions converted to percentages; AA evaluation recipe retained.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience",
    value: -26.6666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Published index on the -100 to 100 scale.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience-accuracy",
    value: 17.133333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Accuracy fraction converted to percent.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "aa-omniscience-hallucination-rate",
    value: 52.85599356395817,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis AA-Omniscience",
    notes: "Hallucination-rate fraction converted to percent; lower is better.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "output-speed",
    value: 52.5592091373545,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis first-party Alibaba API performance",
    notes: "Median output throughput; not local hardware throughput.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "time-to-first-answer-token",
    value: 41.92450124326472,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis first-party Alibaba API performance",
    notes: "Includes reasoning time; not time to first chunk.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "terminal-bench-2-1",
    value: 73,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen model-card evaluation; Terminus",
    notes: "Vendor result retained alongside AA; best numeric result selected."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "deepswe-1-1",
    value: 42.2,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Claude Code; temperature 1.0; top_p 0.95; 256K context",
    notes: "Vendor evaluation, not the mini-swe-agent leaderboard configuration."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "hle",
    value: 30.8,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen model-card evaluation; GPT-4o judge",
    notes: "Vendor result retained alongside AA; best numeric result selected."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "osworld-verified",
    value: 84.3,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen model-card OSWorld-Verified evaluation; further run settings not published",
    notes: "Version identified as Verified; do not substitute for OSWorld 2.0."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "baby-vision",
    value: 85.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen model-card BabyVision with code interpreter",
    notes: "With-CI score; without-CI score is 65.7. Native vision model; tool assistance retained in provenance."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "baby-vision",
    value: 65.7,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-27B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen model-card BabyVision without code interpreter",
    notes: "Without-CI score retained; with-CI 85.6 is higher."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "arena-text-multi-turn",
    value: 1446,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena anonymous multi-turn human preference voting",
    notes: "September 2 leaderboard snapshot; rating 1446 +/-18, 1,202 votes. No effort or mode label in row."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "agent-arena",
    value: 1.03,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent?rankBy=models",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Agent Arena causal net improvement across five real-session signals",
    notes: "Live row: 22,585 sessions; +/-0.99 percentage points. Supersedes the older 17,495-session 1.19 row; temporal updates are not independent effort runs."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "agent-arena-praise-vs-complaint",
    value: 0.78,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent?rankBy=models",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Agent Arena causal Praise vs Complaint treatment effect",
    notes: "Live row: 22,585 sessions; +/-3.28 percentage points. Percentage-point improvement, not praise share. Supersedes older 0.84 row."
  },
  {
    modelId: "qwen3-8-27b",
    metricId: "roboflow-visual-reasoning",
    value: 66,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    reasoningBudget: "high",
    scaffoldOrHarness: "Roboflow visual reasoning; self-hosted row; ground-truth accuracy",
    notes: "Published mean of three runs: 66.0 +/-0.7, range 65.6-66.9. Precision not exposed in extracted row; preserve source configuration rather than treating best single trial as aggregate. Hosted high row reports 62.3.",
    reasoningMode: "reasoning"
  }
];

// src/data/supplementalModelObservations.ts
var supplementalModelObservations = [
  {
    modelId: "qwen3-8-max-0902",
    metricId: "deepswe-1-1",
    value: 69.3,
    observationDate: "2026-09-02",
    sourceUrl: "https://x.com/Alibaba_Qwen/status/2094968708288680276",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "mini-SWE-agent; temperature 1.0, top_p 0.95, 1M context",
    notes: "Official release chart footnote 3; pass@1. Exact September 2 snapshot; original-release scores are not transferred. Chart: https://pbs.twimg.com/media/HRLPmfLagAA9ATq.jpg"
  },
  {
    modelId: "qwen3-8-max-0902",
    metricId: "swe-atlas-qna",
    value: 66.3,
    observationDate: "2026-09-02",
    sourceUrl: "https://x.com/Alibaba_Qwen/status/2094968708288680276",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen publisher SWE-Atlas QnA evaluation; harness not published",
    notes: "Official release chart; repository-level code understanding. Exact September 2 snapshot; original-release scores are not transferred. Chart: https://pbs.twimg.com/media/HRLPmfLagAA9ATq.jpg"
  },
  {
    modelId: "qwen3-8-max-0902",
    metricId: "baby-vision",
    value: 93.8,
    observationDate: "2026-09-02",
    sourceUrl: "https://x.com/Alibaba_Qwen/status/2094968708288680276",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Qwen publisher BabyVision with code interpreter",
    notes: "Official release chart explicitly labels BabyVision (w/ CI). Exact September 2 snapshot; original-release scores are not transferred. Chart: https://pbs.twimg.com/media/HRLPmfLagAA9ATq.jpg"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "tau3-banking",
    value: 47.2164948453608,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "terminal-bench-2-1",
    value: 84.2696629213483,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "scicode",
    value: 51.6203703703704,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "aa-lcr",
    value: 80,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "hle",
    value: 39.8517145505097,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "critpt",
    value: 15.4285714285714,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "enterprise-ops-gym-aa",
    value: 33.21396598030439,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "aa-omniscience",
    value: 7.46666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "aa-omniscience-accuracy",
    value: 27.500000000000004,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "aa-omniscience-hallucination-rate",
    value: 27.632183908045977,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "aa-briefcase",
    value: 1460.68,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "output-speed",
    value: 46.1130926849213,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "time-to-first-answer-token",
    value: 44.89866443424736,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "time-per-task",
    value: 931.3504376344944,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "cost-per-task",
    value: 0.18254869918932465,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "tau3-banking",
    value: 51.340206185567006,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "terminal-bench-2-1",
    value: 81.2734082397004,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "scicode",
    value: 53.2407407407407,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "aa-lcr",
    value: 78.3333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "hle",
    value: 43.0491195551437,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "critpt",
    value: 20,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "mmmu-pro",
    value: 82.3121387283237,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "aa-omniscience",
    value: 3.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "aa-omniscience-accuracy",
    value: 31.85,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "aa-omniscience-hallucination-rate",
    value: 41.746148202494496,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "aa-briefcase",
    value: 1394.96,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "output-speed",
    value: 40.1960520620431,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "time-to-first-answer-token",
    value: 52.108636818865996,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "time-per-task",
    value: 795.8043831753286,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "cost-per-task",
    value: 1.1876933515414076,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "tau3-banking",
    value: 45.360824742268,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "terminal-bench-2-1",
    value: 86.1423220973783,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "scicode",
    value: 50.578703703703695,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "aa-lcr",
    value: 79.6666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "hle",
    value: 38.044485634847106,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "critpt",
    value: 11.1428571428571,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "mmmu-pro",
    value: 79.7687861271676,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "aa-omniscience",
    value: -9.71666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "aa-omniscience-accuracy",
    value: 24.5,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "aa-omniscience-hallucination-rate",
    value: 45.32008830022075,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "output-speed",
    value: 80.1255847024846,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "time-to-first-answer-token",
    value: 27.6094395014034,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "tau3-banking",
    value: 39.381443298969096,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "terminal-bench-2-1",
    value: 78.65168539325839,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "scicode",
    value: 50.3472222222222,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "aa-lcr",
    value: 79.6666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "hle",
    value: 38.5542168674699,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "critpt",
    value: 16.5714285714286,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "aa-omniscience",
    value: -14.2833333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "aa-omniscience-accuracy",
    value: 40.38333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "aa-omniscience-hallucination-rate",
    value: 91.69695275370422,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "aa-briefcase",
    value: 1264.7,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "output-speed",
    value: 131.420725444775,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "time-to-first-answer-token",
    value: 16.15469962988648,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "time-per-task",
    value: 343.32836097964235,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "cost-per-task",
    value: 0.1397446276128162,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    reasoningBudget: "max",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "tau3-banking",
    value: 29.6907216494845,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "terminal-bench-2-1",
    value: 80.1498127340824,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "scicode",
    value: 52.3148148148148,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-lcr",
    value: 79,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "hle",
    value: 41.8906394810009,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "critpt",
    value: 27.142857142857103,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "mmmu-pro",
    value: 79.47976878612721,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience",
    value: -2.98333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-accuracy",
    value: 45.516666666666666,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-hallucination-rate",
    value: 89.0180483328235,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-briefcase",
    value: 1343.26,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "output-speed",
    value: 95.3173584559315,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "time-to-first-answer-token",
    value: 53.8777163764999,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "time-per-task",
    value: 175.56423198738537,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "cost-per-task",
    value: 0.5020714467630832,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "tau3-banking",
    value: 28.659793814432998,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "terminal-bench-2-1",
    value: 75.6554307116105,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "scicode",
    value: 52.4305555555556,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-lcr",
    value: 77.6666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "hle",
    value: 38.5078776645042,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "critpt",
    value: 22.8571428571429,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "mmmu-pro",
    value: 79.0751445086705,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience",
    value: -3.46666666666667,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-accuracy",
    value: 45.483333333333334,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-hallucination-rate",
    value: 89.78905533476002,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-briefcase",
    value: 1205.92,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "output-speed",
    value: 96.2469811560645,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "time-to-first-answer-token",
    value: 3.67067760499999,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "time-per-task",
    value: 103.8124807645094,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "cost-per-task",
    value: 0.2978604840727988,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    reasoningBudget: "high",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "tau3-banking",
    value: 25.5670103092783,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "terminal-bench-2-1",
    value: 72.2846441947566,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-lcr",
    value: 74,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "hle",
    value: 33.271547729379094,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "critpt",
    value: 17.4285714285714,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "mmmu-pro",
    value: 76.7630057803468,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience",
    value: -5.13333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-accuracy",
    value: 44.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-hallucination-rate",
    value: 89.7713598074609,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-briefcase",
    value: 1043.8,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "output-speed",
    value: 86.9053940436348,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "time-to-first-answer-token",
    value: 1.82512967350007,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    reasoningBudget: "medium",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "tau3-banking",
    value: 18.7628865979381,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "terminal-bench-2-1",
    value: 62.546816479400704,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-lcr",
    value: 71.3333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "hle",
    value: 29.1936978683967,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "critpt",
    value: 9.42857142857143,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "mmmu-pro",
    value: 76.1271676300578,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience",
    value: -6.83333333333333,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-accuracy",
    value: 43.733333333333334,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-omniscience-hallucination-rate",
    value: 89.8696682464455,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "aa-briefcase",
    value: 1014.43,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "output-speed",
    value: 92.7239411160006,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "time-to-first-answer-token",
    value: 1.74032420049992,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    reasoningBudget: "low",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "tau3-banking",
    value: 15.2577319587629,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "terminal-bench-2-1",
    value: 65.1685393258427,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "scicode",
    value: 47.1064814814815,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "aa-lcr",
    value: 83,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "hle",
    value: 38.9712696941613,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "critpt",
    value: 3.7142857142857104,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "mmmu-pro",
    value: 78.5549132947977,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "enterprise-ops-gym-aa",
    value: 32.10981796478663,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "aa-omniscience",
    value: 1.35,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "aa-omniscience-accuracy",
    value: 16.7,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "aa-omniscience-hallucination-rate",
    value: 18.42737094837935,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "aa-briefcase",
    value: 1101.15,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "output-speed",
    value: 84.6381855555648,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "time-to-first-answer-token",
    value: 25.1547486469301,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "time-per-task",
    value: 366.1898505142743,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "minimax-m3",
    metricId: "cost-per-task",
    value: 0.22940861923964795,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5, 2026 model-page data",
    notes: "Exact release; AA recipe retained. HLE excludes tools, MMMU-Pro uses AA 10-option evaluation, LCR is v1.1. Performance uses median output speed, first answer token, and current Index task aggregates. Unspecified effort is not inferred.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "agent-arena",
    value: 5.51,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "qwen3-8-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 6.58,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "qwen3-8-max",
    metricId: "arena-text-multi-turn",
    value: 1493,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena blind multi-turn text preference; September 2 leaderboard",
    notes: "Published multi-turn rating."
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "agent-arena",
    value: 3.67,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "agent-arena-praise-vs-complaint",
    value: 5.45,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "arena-text-multi-turn",
    value: 1466,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena blind multi-turn text preference; September 2 leaderboard",
    notes: "Published multi-turn rating."
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "agent-arena",
    value: 3.29,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "high",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "agent-arena-praise-vs-complaint",
    value: 3.9,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "high",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "agent-arena",
    value: 3.04,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "agent-arena-praise-vs-complaint",
    value: 1.41,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "arena-text-multi-turn",
    value: 1472,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "Arena blind multi-turn text preference; September 2 leaderboard",
    notes: "Published multi-turn rating.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "agent-arena",
    value: 2.61,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "agent-arena-praise-vs-complaint",
    value: 0.24,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "minimax-m3",
    metricId: "agent-arena",
    value: -3.76,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "minimax-m3",
    metricId: "agent-arena-praise-vs-complaint",
    value: -9.86,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena real-user agent sessions; September 5 snapshot",
    notes: "Signed percentage-point improvement. Negative signs verified from the table's downward arrows. Praise/complaint is also an ingredient of the overall signal."
  },
  {
    modelId: "minimax-m3",
    metricId: "arena-text-multi-turn",
    value: 1451,
    observationDate: "2026-09-05",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Arena blind multi-turn text preference; September 2 leaderboard",
    notes: "Published multi-turn rating."
  },
  {
    modelId: "qwen3-8-max",
    metricId: "roboflow-visual-reasoning",
    value: 80.3,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    reasoningBudget: "high",
    scaffoldOrHarness: "Roboflow Visual Reasoning; high configuration",
    notes: "Ground-truth score, not strict-match score. Mean of 3 trials; SD 2.0.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "roboflow-visual-reasoning",
    value: 65.3,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    reasoningBudget: "high",
    scaffoldOrHarness: "Roboflow Visual Reasoning; high configuration",
    notes: "Ground-truth score, not strict-match score. Mean of 3 trials; SD 1.0.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "roboflow-visual-reasoning",
    value: 59.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    reasoningBudget: "high",
    scaffoldOrHarness: "Roboflow Visual Reasoning; high configuration",
    notes: "Ground-truth score, not strict-match score. Single trial.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "deepswe-1-1",
    value: 69.62305986696231,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "max",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "deepswe-1-1",
    value: 60.17699115044248,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "deepswe-1-1",
    value: 53.76106194690266,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "high",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "deepswe-1-1",
    value: 35.11111111111111,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "medium",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "gpt-5-6-terra",
    metricId: "deepswe-1-1",
    value: 24.053452115812917,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "low",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "deepswe-1-1",
    value: 63.39285714285714,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "max",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-max",
    metricId: "deepswe-1-1",
    value: 57.46102449888641,
    observationDate: "2026-09-05",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "xhigh",
    scaffoldOrHarness: "DeepSWE v1.1 official leaderboard; mini-swe-agent, four runs",
    notes: "September 3 leaderboard artifact; pass@1 fraction converted to percentage.",
    reasoningMode: "reasoning"
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "deepswe-1-1",
    value: 58.7,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-Flash-Next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Best published harness: mini-swe-agent; compared with Claude Code."
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "deepswe-1-1",
    value: 54.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-Flash-Next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Explicit DeepSeek-V4-Flash-0731 comparison column; winning harness not specified."
  },
  {
    modelId: "qwen3-8-flash-next",
    metricId: "hle",
    value: 35.9,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-Flash-Next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Without tools."
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "hle",
    value: 33.8,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-Flash-Next",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Without tools."
  },
  {
    modelId: "deepseek-v4-flash-0731",
    metricId: "terminal-bench-2-1",
    value: 82.7,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Exact July 31 release."
  },
  {
    modelId: "qwen3-8-max",
    metricId: "terminal-bench-2-1",
    value: 86.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Explicit Qwen3.8-Max API comparison column; Claude Code avg@10, five-hour limit, 131072 output tokens. Raw weights are a distinct model."
  },
  {
    modelId: "qwen3-8-max",
    metricId: "deepswe-1-1",
    value: 56.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Explicit Qwen3.8-Max API column; winning Claude Code harness, 256K context."
  },
  {
    modelId: "qwen3-8-max",
    metricId: "hle",
    value: 43.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Explicit Qwen3.8-Max API comparison column; without tools."
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "terminal-bench-2-1",
    value: 84.3,
    observationDate: "2026-09-05",
    sourceUrl: "https://autoclaw.z.ai/blog/model/glm-5.3-flash/",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Publisher model evaluation."
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "deepswe-1-1",
    value: 63.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://autoclaw.z.ai/blog/model/glm-5.3-flash/",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Rounded publisher value; official independent score is also recorded."
  },
  {
    modelId: "glm-5-3-flash",
    metricId: "baby-vision",
    value: 53.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://autoclaw.z.ai/blog/model/glm-5.3-flash/",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Publisher BabyVision result."
  },
  {
    modelId: "minimax-m3",
    metricId: "terminal-bench-2-1",
    value: 66,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.minimaxi.com/blog/minimax-m3",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Official June 1 release result."
  },
  {
    modelId: "minimax-m3",
    metricId: "osworld-verified",
    value: 75.19,
    observationDate: "2026-09-05",
    sourceUrl: "https://osworld-v1.xlang.ai/static/data/osworld_verified_results.xlsx",
    reasoningBudget: "Not published",
    scaffoldOrHarness: "Published model evaluation; exact benchmark version",
    notes: "Official row MiniMax M3: 100 steps, 269.18 / 358 tasks; no a11y tree, coding actions, or multiple rollout."
  }
];

// src/data/fallbackObservations.ts
var fallbackObservations = [
  {
    modelId: "kimi-k3-max",
    metricId: "automationbench",
    value: 22.68,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "Not published",
    notes: "Previously collected in reports/current-roster-fallbacks-2026-09-05.md; effort unspecified, accepted as the best reported result."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "terminal-bench-science",
    value: 64.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://openai.com/index/gpt-6-astra/",
    scaffoldOrHarness: "OpenAI release comparison; harness not specified in the retained report",
    reasoningBudget: "Best score at any effort (source)",
    notes: "Previously collected in reports/current-roster-fallbacks-2026-09-05.md. Provider release comparison."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "terminal-bench-science",
    value: 52.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://openai.com/index/gpt-6-astra/",
    scaffoldOrHarness: "OpenAI release comparison; harness not specified in the retained report",
    reasoningBudget: "Best score at any effort (source)",
    notes: "Previously collected in reports/current-roster-fallbacks-2026-09-05.md. Provider release comparison; Fable routing not specified."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "terminal-bench-science",
    value: 7.14,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "xhigh",
    notes: "Previously collected in reports/current-roster-fallbacks-2026-09-05.md; retains the report’s two-decimal precision."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "roboflow-visual-reasoning",
    value: 73.1,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "roboflow-visual-reasoning",
    value: 74.2,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "roboflow-visual-reasoning",
    value: 91.2,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "roboflow-visual-reasoning",
    value: 61.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Roboflow maps high to the native high effort/thinking level. Headline judge accuracy, not strict exact-match accuracy."
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    metricId: "roboflow-visual-reasoning",
    value: 73.1,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "roboflow-visual-reasoning",
    value: 74.2,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "roboflow-visual-reasoning",
    value: 84.5,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Roboflow maps high to the native high effort/thinking level. Headline judge accuracy, not strict exact-match accuracy."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "roboflow-visual-reasoning",
    value: 65.6,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "roboflow-visual-reasoning",
    value: 71.7,
    observationDate: "2026-09-05",
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    scaffoldOrHarness: "Roboflow Vision Evals; visual reasoning; Gemini 3.5 Flash ground-truth judge",
    reasoningBudget: "high (Roboflow tier)",
    notes: "Published high-tier result. Native effort mapping and Fable routing are not confirmed. Accepted under the best-across-efforts policy; provenance retains the source tier."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "automationbench",
    value: 31.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "max",
    notes: "Fable 5.1 with Opus 5 fallback; Opus served about 40% of tasks. Standalone Fable scored 22.37%."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "automationbench",
    value: 26.94,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "automationbench",
    value: 41.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "max"
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "automationbench",
    value: 29.68,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "high"
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "automationbench",
    value: 17.05,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "automationbench",
    value: 28.77,
    observationDate: "2026-09-05",
    sourceUrl: "https://zapier.com/benchmarks",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; strict task_completed_correctly",
    reasoningBudget: "max"
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "enterprise-ops-gym-aa",
    value: 47.4783646672635,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "max"
  },
  {
    modelId: "grok-4-6-high",
    metricId: "enterprise-ops-gym-aa",
    value: 48.343777976723366,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "high"
  },
  {
    modelId: "kimi-k3-max",
    metricId: "enterprise-ops-gym-aa",
    value: 45.329752312742464,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "max"
  },
  {
    modelId: "glm-5-3-max",
    metricId: "enterprise-ops-gym-aa",
    value: 36.436884512085946,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "max"
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "enterprise-ops-gym-aa",
    value: 49.59713518352731,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "enterprise-ops-gym-aa",
    value: 40.82363473589973,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "enterprise-ops-gym-aa",
    value: 42.9125634139063,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
    scaffoldOrHarness: "AA Stirrup; oracle tool mode; strict task success; three repeats",
    reasoningBudget: "max"
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "terminal-bench-science",
    value: 30,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "Claude Code; Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "terminal-bench-science",
    value: 22.380952380952383,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "Codex; Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "max"
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "terminal-bench-science",
    value: 12.380952380952381,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "mini-SWE-agent; Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "high"
  },
  {
    modelId: "glm-5-3-max",
    metricId: "terminal-bench-science",
    value: 8.095238095238095,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "Claude Code; Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "max"
  },
  {
    modelId: "kimi-k3-max",
    metricId: "terminal-bench-science",
    value: 7.142857142857142,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "Claude Code; Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "terminal-bench-science",
    value: 3.3333333333333335,
    observationDate: "2026-09-05",
    sourceUrl: "https://www.terminal-bench-science.ai/",
    scaffoldOrHarness: "Codex; Terminal-Bench-Science 0.1; three trials per task",
    reasoningBudget: "max"
  }
];

// src/data/coverageFallbackObservations.ts
var coverageFallbackObservations = [
  {
    modelId: "claude-fable-5-1-max",
    metricId: "terminal-bench-2-1",
    value: 91.39,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "terminal-bench-2-1",
    value: 89.14,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "mmmu-pro",
    value: 84.74,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "terminal-bench-2-1",
    value: 88.39,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "mmmu-pro",
    value: 86.88,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "terminal-bench-2-1",
    value: 88.39,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "high",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    metricId: "terminal-bench-2-1",
    value: 85.39,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "xhigh",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    metricId: "mmmu-pro",
    value: 82.02,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "xhigh",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "terminal-bench-2-1",
    value: 85.02,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "mmmu-pro",
    value: 80.52,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "glm-5-3-max",
    metricId: "terminal-bench-2-1",
    value: 83.9,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "terminal-bench-2-1",
    value: 87.64,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "high",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "mmmu-pro",
    value: 85.61,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "high",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "terminal-bench-2-1",
    value: 78.65,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "terminal-bench-2-1",
    value: 80.9,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "mmmu-pro",
    value: 78.55,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "terminal-bench-2-1",
    value: 88.01,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
    scaffoldOrHarness: "AA Terminus 2; Terminal-Bench 2.1",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "mmmu-pro",
    value: 83.41,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
    scaffoldOrHarness: "AA MMMU-Pro; 10-option evaluation",
    reasoningBudget: "max",
    notes: "Imported at the two-decimal precision retained in reports/benchmark-fallback-research-2026-09-05.md; exact release/effort AA snapshot. Fable uses its labeled default-fallback configuration."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "arc-agi-2",
    value: 90,
    observationDate: "2026-09-05",
    sourceUrl: "https://arcprize.org/results/anthropic-claude-fable-5-1",
    scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
    reasoningBudget: "See source; effort not established as an exact match",
    notes: "Recorded ARC Prize result from the September 5 research report. Exact effort is unspecified and accepted as the best reported effort result; the published harness is retained."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "arc-agi-2",
    value: 60.4,
    observationDate: "2026-09-05",
    sourceUrl: "https://arcprize.org/results/moonshot-kimi-k3",
    scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
    reasoningBudget: "See source; effort not established as an exact match",
    notes: "Recorded ARC Prize result from the September 5 research report. Exact effort is unspecified and accepted as the best reported effort result; the published harness is retained."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "arc-agi-2",
    value: 61.3,
    observationDate: "2026-09-05",
    sourceUrl: "https://arcprize.org/results/deepseek-v4-pro-0813",
    scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
    reasoningBudget: "See source; effort not established as an exact match",
    notes: "Recorded ARC Prize result from the September 5 research report. Exact effort is unspecified and accepted as the best reported effort result; the published harness is retained."
  }
];

// src/data/preferenceComputerObservations.ts
var preferenceComputerObservations = [
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "arena-text-multi-turn",
    value: 1516,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published rating +/-22; 779 votes; collected 2026-09-05. Source marks this result preliminary."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "arena-text-multi-turn",
    value: 1499,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published rating +/-12; 2887 votes; collected 2026-09-05."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "arena-text-multi-turn",
    value: 1487,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published rating +/-10; 3922 votes; collected 2026-09-05."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "arena-text-multi-turn",
    value: 1486,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published rating +/-9; 5645 votes; collected 2026-09-05."
  },
  {
    modelId: "glm-5-3-max",
    metricId: "arena-text-multi-turn",
    value: 1485,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published rating +/-18; 1161 votes; collected 2026-09-05."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "arena-text-multi-turn",
    value: 1482,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published rating +/-12; 2660 votes; collected 2026-09-05."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "arena-text-multi-turn",
    value: 1480,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published rating +/-30; 376 votes; collected 2026-09-05. Source labels claude-fable-5.1-max; fallback routing is not specified, so this record does not establish a fallback-assisted run."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "arena-text-multi-turn",
    value: 1463,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published rating +/-21; 877 votes; collected 2026-09-05."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "arena-text-multi-turn",
    value: 1458,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published rating +/-10; 4134 votes; collected 2026-09-05."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "arena-text-multi-turn",
    value: 1446,
    observationDate: "2026-09-02",
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    scaffoldOrHarness: "Arena anonymous multi-turn text battles; no additional adjustment requested",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published rating +/-25; 568 votes; collected 2026-09-05. Source marks this result preliminary."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "agent-arena",
    value: 13.74,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-1.8 percentage points (95% interval); model row lists 21688 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 21.82,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-6.81 percentage points (95% interval); model row lists 21688 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "agent-arena",
    value: 11.69,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-2.01 percentage points (95% interval); model row lists 17295 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 18.35,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-7.36 percentage points (95% interval); model row lists 17295 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "agent-arena",
    value: 9.49,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-1.51 percentage points (95% interval); model row lists 28781 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 21.62,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-5.62 percentage points (95% interval); model row lists 28781 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "agent-arena",
    value: 8.71,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-0.66 percentage points (95% interval); model row lists 95285 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 15.85,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-2.31 percentage points (95% interval); model row lists 95285 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "agent-arena",
    value: 5.94,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-1.91 percentage points (95% interval); model row lists 10103 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "agent-arena-praise-vs-complaint",
    value: 14.78,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-6.3 percentage points (95% interval); model row lists 10103 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "agent-arena",
    value: 5.91,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-1.04 percentage points (95% interval); model row lists 26473 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 5.47,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-3.51 percentage points (95% interval); model row lists 26473 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "agent-arena",
    value: 5.33,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-1.27 percentage points (95% interval); model row lists 15796 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "agent-arena-praise-vs-complaint",
    value: 2.48,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-4.3 percentage points (95% interval); model row lists 15796 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "glm-5-3-max",
    metricId: "agent-arena",
    value: 3.74,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-0.77 percentage points (95% interval); model row lists 43951 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "glm-5-3-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 4.27,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-2.53 percentage points (95% interval); model row lists 43951 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "agent-arena",
    value: 2.15,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-1.2 percentage points (95% interval); model row lists 17115 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "agent-arena-praise-vs-complaint",
    value: 0.19,
    observationDate: "2026-09-01",
    sourceUrl: "https://arena.ai/leaderboard/agent",
    scaffoldOrHarness: "Arena Agent Mode; overall category; randomized orchestrator causal tracing",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Published treatment-effect estimate +/-3.91 percentage points (95% interval); model row lists 17115 sessions, not necessarily all contributing to this signal. Collected 2026-09-05. This is not raw satisfaction or success rate."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-2",
    value: 22.32,
    observationDate: "2026-09-03",
    sourceUrl: "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json",
    scaffoldOrHarness: "XLANG official; v2026.08.08; full set; 500 steps; batch tool",
    reasoningBudget: "low",
    reasoningMode: "reasoning",
    notes: "Binary full completion. Companion partial reward 54.89% is not substituted. August Opus results average seven runs."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-2",
    value: 25.33,
    observationDate: "2026-09-03",
    sourceUrl: "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json",
    scaffoldOrHarness: "XLANG official; v2026.08.08; full set; 500 steps; batch tool",
    reasoningBudget: "medium",
    reasoningMode: "reasoning",
    notes: "Binary full completion. Companion partial reward 60.49% is not substituted. August Opus results average seven runs."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-2",
    value: 28.98,
    observationDate: "2026-09-03",
    sourceUrl: "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json",
    scaffoldOrHarness: "XLANG official; v2026.08.08; full set; 500 steps; batch tool",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    notes: "Binary full completion. Companion partial reward 63.79% is not substituted. August Opus results average seven runs."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-2",
    value: 30.21,
    observationDate: "2026-09-03",
    sourceUrl: "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json",
    scaffoldOrHarness: "XLANG official; v2026.08.08; full set; 500 steps; batch tool",
    reasoningBudget: "xhigh",
    reasoningMode: "reasoning",
    notes: "Binary full completion. Companion partial reward 67.67% is not substituted. August Opus results average seven runs."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-2",
    value: 31.43,
    observationDate: "2026-09-03",
    sourceUrl: "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json",
    scaffoldOrHarness: "XLANG official; v2026.08.08; full set; 500 steps; batch tool",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Binary full completion. Companion partial reward 68.31% is not substituted. August Opus results average seven runs."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "osworld-2",
    value: 27.34,
    observationDate: "2026-09-03",
    sourceUrl: "https://osworld-v2.xlang.ai/static/data/leaderboard/official-results.json",
    scaffoldOrHarness: "XLANG official; v2026.08.08; full set; 500 steps; batch tool",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Binary full completion; two-run average. Companion partial reward 62.72% is not substituted."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "osworld-2",
    value: 41.7,
    observationDate: "2026-09-01",
    sourceUrl: "https://www.anthropic.com/claude/fable",
    scaffoldOrHarness: "Anthropic release evaluation; benchmark authors' August 2026 tasks; strict completion",
    reasoningBudget: "Not published",
    notes: "Official release chart inspected; partial score 77.9% retained here only. Provider harness differs from XLANG's 500-step run; best recorded result is selected under project policy. Production safeguards enabled; interventions score zero on OSWorld, rather than invoking fallback models."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-2",
    value: 39.6,
    observationDate: "2026-09-01",
    sourceUrl: "https://www.anthropic.com/claude/fable",
    scaffoldOrHarness: "Anthropic release evaluation; benchmark authors' August 2026 tasks; strict completion",
    reasoningBudget: "Not published",
    notes: "Official release chart inspected; partial score 75.4% retained here only. Provider harness differs from XLANG's 500-step run; best recorded result is selected under project policy."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "osworld-verified",
    value: 83.39,
    observationDate: "2026-09-05",
    sourceUrl: "https://osworld-v1.xlang.ai/static/data/osworld_verified_results.xlsx",
    scaffoldOrHarness: "Official claude-opus-5[1m] row; 100 steps; no a11y tree, coding action or multiple rollout",
    reasoningBudget: "Not published",
    notes: "300.2/360 evaluated tasks; retrieved September 5. Preserve denominator and harness instead of assuming identical settings across sources."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "osworld-verified",
    value: 84.8,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/moonshotai/Kimi-K3",
    scaffoldOrHarness: "Moonshot Kimi K3 model-card OSWorld-Verified comparison; harness not specified",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Vendor-reported Kimi result; max effort and temperature 1.0 per model-card notes."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "osworld-verified",
    value: 83,
    observationDate: "2026-09-05",
    sourceUrl: "https://huggingface.co/moonshotai/Kimi-K3",
    scaffoldOrHarness: "Moonshot Kimi K3 model-card OSWorld-Verified comparison; harness not specified",
    reasoningBudget: "max",
    reasoningMode: "reasoning",
    notes: "Sol comparison result published by Moonshot; not an independently reproduced XLANG row."
  }
];

// src/data/reasoningObservations.ts
var aaReasoningRuns = [
  {
    modelId: "gpt-6-astra-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 41.4432989690722,
      "terminal-bench-2-1": 88.38951310861421,
      scicode: 56.4814814814815,
      "aa-lcr": 80.6666666666667,
      hle: 54.6802594995366,
      critpt: 31.7142857142857,
      "mmmu-pro": 86.878612716763,
      "aa-omniscience": 43.4,
      "aa-omniscience-accuracy": 62.6,
      "aa-omniscience-hallucination-rate": 51.33689839572193,
      "aa-briefcase": 1565.51,
      "output-speed": 64.2593026649757,
      "time-to-first-answer-token": 384.297429276,
      "time-per-task": 318.2339872201213,
      "cost-per-task": 2.56731851528698
    }
  },
  {
    modelId: "gpt-6-astra-max",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra-xhigh",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 43.0927835051546,
      "terminal-bench-2-1": 89.1385767790262,
      scicode: 55.671296296296305,
      "aa-lcr": 80,
      hle: 54.587581093605195,
      critpt: 31.4285714285714,
      "mmmu-pro": 86.242774566474,
      "aa-omniscience": 43.4166666666667,
      "aa-omniscience-accuracy": 61.85000000000001,
      "aa-omniscience-hallucination-rate": 48.318042813455655,
      "aa-briefcase": 1539.65,
      "output-speed": 61.9326087133095,
      "time-to-first-answer-token": 167.9825433715,
      "time-per-task": 216.87186859321974,
      "cost-per-task": 1.8473482910979575
    }
  },
  {
    modelId: "gpt-6-astra-max",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra-high",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 40,
      "terminal-bench-2-1": 89.8876404494382,
      scicode: 55.4398148148148,
      "aa-lcr": 80,
      hle: 53.058387395736794,
      critpt: 28.857142857142897,
      "mmmu-pro": 86.4161849710983,
      "aa-omniscience": 43.7333333333333,
      "aa-omniscience-accuracy": 61.133333333333326,
      "aa-omniscience-hallucination-rate": 44.76843910806175,
      "aa-briefcase": 1499.79,
      "output-speed": 60.7587164592154,
      "time-to-first-answer-token": 96.0539833135,
      "time-per-task": 152.4840620003474,
      "cost-per-task": 1.4110209802305576
    }
  },
  {
    modelId: "gpt-6-astra-max",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra-medium",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 35.4639175257732,
      "terminal-bench-2-1": 89.5131086142322,
      scicode: 54.1666666666667,
      "aa-lcr": 79.6666666666667,
      hle: 52.73401297497679,
      critpt: 29.1428571428571,
      "mmmu-pro": 85.08670520231209,
      "aa-omniscience": 42.2166666666667,
      "aa-omniscience-accuracy": 60.56666666666667,
      "aa-omniscience-hallucination-rate": 46.53423499577345,
      "aa-briefcase": 1451.45,
      "output-speed": 59.4687489296211,
      "time-to-first-answer-token": 9.6452984395,
      "time-per-task": 115.83866432808833,
      "cost-per-task": 1.1612346511335152
    }
  },
  {
    modelId: "gpt-6-astra-max",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra-low",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 31.958762886597903,
      "terminal-bench-2-1": 88.0149812734082,
      scicode: 54.050925925925895,
      "aa-lcr": 80,
      hle: 49.2122335495829,
      critpt: 26.285714285714302,
      "mmmu-pro": 84.6242774566474,
      "aa-omniscience": 40.55,
      "aa-omniscience-accuracy": 59.53333333333334,
      "aa-omniscience-hallucination-rate": 46.91103789126853,
      "aa-briefcase": 1259.37,
      "output-speed": 60.0613202212249,
      "time-to-first-answer-token": 2.49434505350002,
      "time-per-task": 50.868878763451264,
      "cost-per-task": 0.6310043447720995
    }
  },
  {
    modelId: "gpt-5-6-terra",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 40.2061855670103,
      "terminal-bench-2-1": 88.0149812734082,
      scicode: 54.976851851851805,
      "aa-lcr": 83,
      hle: 42.9101019462465,
      critpt: 30,
      "mmmu-pro": 80.6936416184971,
      "enterprise-ops-gym-aa": 38.49597135183527,
      "aa-omniscience": 0.05,
      "aa-omniscience-accuracy": 46.800000000000004,
      "aa-omniscience-hallucination-rate": 87.87593984962406,
      "aa-briefcase": 1334.93,
      "output-speed": 113.933793932466,
      "time-to-first-answer-token": 168.776165367,
      "time-per-task": 239.5261131894483,
      "cost-per-task": 0.814375986648548
    }
  },
  {
    modelId: "gpt-5-6-terra",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-xhigh",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 29.6907216494845,
      "terminal-bench-2-1": 80.1498127340824,
      scicode: 52.3148148148148,
      "aa-lcr": 79,
      hle: 41.8906394810009,
      critpt: 27.142857142857103,
      "mmmu-pro": 79.47976878612721,
      "aa-omniscience": -2.98333333333333,
      "aa-omniscience-accuracy": 45.516666666666666,
      "aa-omniscience-hallucination-rate": 89.0180483328235,
      "aa-briefcase": 1343.26,
      "output-speed": 95.3173584559315,
      "time-to-first-answer-token": 53.8777163764999,
      "time-per-task": 175.56423198738537,
      "cost-per-task": 0.5020714467630832
    }
  },
  {
    modelId: "gpt-5-6-terra",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-high",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 28.659793814432998,
      "terminal-bench-2-1": 75.6554307116105,
      scicode: 52.4305555555556,
      "aa-lcr": 77.6666666666667,
      hle: 38.5078776645042,
      critpt: 22.8571428571429,
      "mmmu-pro": 79.0751445086705,
      "aa-omniscience": -3.46666666666667,
      "aa-omniscience-accuracy": 45.483333333333334,
      "aa-omniscience-hallucination-rate": 89.78905533476002,
      "aa-briefcase": 1205.92,
      "output-speed": 96.2469811560645,
      "time-to-first-answer-token": 3.67067760499999,
      "time-per-task": 103.8124807645094,
      "cost-per-task": 0.2978604840727988
    }
  },
  {
    modelId: "gpt-5-6-terra",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-medium",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 25.5670103092783,
      "terminal-bench-2-1": 72.2846441947566,
      "aa-lcr": 74,
      hle: 33.271547729379094,
      critpt: 17.4285714285714,
      "mmmu-pro": 76.7630057803468,
      "aa-omniscience": -5.13333333333333,
      "aa-omniscience-accuracy": 44.6,
      "aa-omniscience-hallucination-rate": 89.7713598074609,
      "aa-briefcase": 1043.8,
      "output-speed": 86.9053940436348,
      "time-to-first-answer-token": 1.82512967350007
    }
  },
  {
    modelId: "gpt-5-6-terra",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-terra-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 18.7628865979381,
      "terminal-bench-2-1": 62.546816479400704,
      "aa-lcr": 71.3333333333333,
      hle: 29.1936978683967,
      critpt: 9.42857142857143,
      "mmmu-pro": 76.1271676300578,
      "aa-omniscience": -6.83333333333333,
      "aa-omniscience-accuracy": 43.733333333333334,
      "aa-omniscience-hallucination-rate": 89.8696682464455,
      "aa-briefcase": 1014.43,
      "output-speed": 92.7239411160006,
      "time-to-first-answer-token": 1.74032420049992
    }
  },
  {
    modelId: "gpt-5-6-luna-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-luna",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 31.1340206185567,
      "terminal-bench-2-1": 80.8988764044944,
      scicode: 53.587962962963,
      "aa-lcr": 83.6666666666667,
      hle: 39.4810009267841,
      critpt: 20.571428571428598,
      "mmmu-pro": 78.5549132947977,
      "enterprise-ops-gym-aa": 40.82363473589973,
      "aa-omniscience": -10.2833333333333,
      "aa-omniscience-accuracy": 42.733333333333334,
      "aa-omniscience-hallucination-rate": 92.57857974388824,
      "aa-briefcase": 1344.66,
      "output-speed": 127.220498052,
      "time-to-first-answer-token": 134.069162207,
      "time-per-task": 234.44837872065477,
      "cost-per-task": 0.09689948478566558
    }
  },
  {
    modelId: "gpt-5-6-luna-max",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-luna-xhigh",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 28.659793814432998,
      "terminal-bench-2-1": 77.9026217228464,
      scicode: 50.462962962963,
      "aa-lcr": 81.6666666666667,
      hle: 36.9786839666358,
      critpt: 20.571428571428598,
      "mmmu-pro": 78.5549132947977,
      "aa-omniscience": -10.7666666666667,
      "aa-omniscience-accuracy": 42.449999999999996,
      "aa-omniscience-hallucination-rate": 92.47031566753547,
      "aa-briefcase": 1273.2,
      "output-speed": 116.87157006563,
      "time-to-first-answer-token": 66.3995205024999,
      "time-per-task": 161.7249625636465,
      "cost-per-task": 0.057387704915564754
    }
  },
  {
    modelId: "gpt-5-6-luna-max",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-luna-high",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 25.1546391752577,
      "terminal-bench-2-1": 69.6629213483146,
      "aa-lcr": 80.3333333333333,
      hle: 33.4105653382762,
      critpt: 16.5714285714286,
      "mmmu-pro": 77.5722543352601,
      "aa-omniscience": -12,
      "aa-omniscience-accuracy": 41.78333333333333,
      "aa-omniscience-hallucination-rate": 92.38476953907816,
      "aa-briefcase": 1179.04,
      "output-speed": 124.110574567678,
      "time-to-first-answer-token": 22.239704299
    }
  },
  {
    modelId: "gpt-5-6-luna-max",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-luna-medium",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 17.7319587628866,
      "terminal-bench-2-1": 53.1835205992509,
      "aa-lcr": 75,
      hle: 25.7645968489342,
      critpt: 4.857142857142859,
      "mmmu-pro": 75.8381502890173,
      "aa-omniscience": -13.1833333333333,
      "aa-omniscience-accuracy": 40.699999999999996,
      "aa-omniscience-hallucination-rate": 90.86565486228218,
      "aa-briefcase": 934.45,
      "output-speed": 107.050162148836,
      "time-to-first-answer-token": 3.31833432850001
    }
  },
  {
    modelId: "gpt-5-6-luna-max",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-luna-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 12.7835051546392,
      "terminal-bench-2-1": 43.4456928838951,
      "aa-lcr": 70,
      hle: 19.8331788693234,
      critpt: 2.57142857142857,
      "mmmu-pro": 73.9884393063584,
      "aa-omniscience": -14.65,
      "aa-omniscience-accuracy": 39.61666666666667,
      "aa-omniscience-hallucination-rate": 89.87027325420922,
      "aa-briefcase": 743.54,
      "output-speed": 108.758433889349,
      "time-to-first-answer-token": 1.74359535299999
    }
  },
  {
    modelId: "gpt-5-6-sol-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-sol",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 44.3298969072165,
      "terminal-bench-2-1": 88.0149812734082,
      scicode: 57.0601851851852,
      "aa-lcr": 84,
      hle: 49.4902687673772,
      critpt: 32.2857142857143,
      "mmmu-pro": 83.4104046242775,
      "enterprise-ops-gym-aa": 42.9125634139063,
      "aa-omniscience": 21.9666666666667,
      "aa-omniscience-accuracy": 59.4,
      "aa-omniscience-hallucination-rate": 92.20032840722496,
      "aa-briefcase": 1481.15,
      "output-speed": 89.7054804508901,
      "time-to-first-answer-token": 140.0817460225,
      "time-per-task": 249.1566930059055,
      "cost-per-task": 1.249461174892833
    }
  },
  {
    modelId: "gpt-5-6-sol-max",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-sol-xhigh",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 38.144329896907195,
      "terminal-bench-2-1": 89.5131086142322,
      scicode: 57.0601851851852,
      "aa-lcr": 82.3333333333333,
      hle: 47.3123262279889,
      critpt: 28.571428571428598,
      "mmmu-pro": 82.6589595375723,
      "aa-omniscience": 20.9833333333333,
      "aa-omniscience-accuracy": 58.81666666666666,
      "aa-omniscience-hallucination-rate": 91.86564144071227,
      "aa-briefcase": 1443.38,
      "output-speed": 82.0397274356525,
      "time-to-first-answer-token": 73.159994057,
      "time-per-task": 189.85559826930074,
      "cost-per-task": 0.8890564320778168
    }
  },
  {
    modelId: "gpt-5-6-sol-max",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-sol-high",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 36.701030927835,
      "terminal-bench-2-1": 87.2659176029963,
      scicode: 57.7546296296296,
      "aa-lcr": 81.6666666666667,
      hle: 46.014828544949,
      critpt: 25.7142857142857,
      "mmmu-pro": 81.84971098265899,
      "aa-omniscience": 20.3666666666667,
      "aa-omniscience-accuracy": 58.35,
      "aa-omniscience-hallucination-rate": 91.19647859143657,
      "aa-briefcase": 1367.17,
      "output-speed": 73.4373473189266,
      "time-to-first-answer-token": 18.82575243,
      "time-per-task": 144.08083715677245,
      "cost-per-task": 0.6145013819157171
    }
  },
  {
    modelId: "gpt-5-6-sol-max",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-sol-medium",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 36.4948453608247,
      "terminal-bench-2-1": 86.1423220973783,
      scicode: 57.4074074074074,
      "aa-lcr": 80.3333333333333,
      hle: 42.2150139017609,
      critpt: 22.8571428571429,
      "mmmu-pro": 81.38728323699421,
      "aa-omniscience": 19.4,
      "aa-omniscience-accuracy": 57.75,
      "aa-omniscience-hallucination-rate": 90.76923076923077,
      "aa-briefcase": 1247.58,
      "output-speed": 72.1471062124554,
      "time-to-first-answer-token": 6.40574776899996,
      "time-per-task": 78.91281132298806,
      "cost-per-task": 0.36714845344225533
    }
  },
  {
    modelId: "gpt-5-6-sol-max",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-5-6-sol-low",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 29.0721649484536,
      "terminal-bench-2-1": 76.77902621722849,
      scicode: 56.3657407407407,
      "aa-lcr": 78,
      hle: 39.3883225208526,
      critpt: 14.857142857142899,
      "mmmu-pro": 80.9826589595376,
      "aa-omniscience": 18.8666666666667,
      "aa-omniscience-accuracy": 57.166666666666664,
      "aa-omniscience-hallucination-rate": 89.41634241245137,
      "aa-briefcase": 1047.88,
      "output-speed": 70.9344134386039,
      "time-to-first-answer-token": 3.17085317700003,
      "time-per-task": 44.848118294801296,
      "cost-per-task": 0.22507131002659145
    }
  },
  {
    modelId: "claude-opus-5-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/claude-opus-5",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 42.0618556701031,
      "terminal-bench-2-1": 89.1385767790262,
      scicode: 56.3657407407407,
      "aa-lcr": 79.3333333333333,
      hle: 54.8656163113994,
      critpt: 29.1428571428571,
      "mmmu-pro": 84.7398843930636,
      "enterprise-ops-gym-aa": 47.4783646672635,
      "aa-omniscience": 37.0666666666667,
      "aa-omniscience-accuracy": 60.86666666666667,
      "aa-omniscience-hallucination-rate": 60.81771720613288,
      "aa-briefcase": 1650.28,
      "output-speed": 56.5647822799873,
      "time-to-first-answer-token": 77.8210250985,
      "time-per-task": 606.5066732810146,
      "cost-per-task": 4.205326614620495
    }
  },
  {
    modelId: "claude-opus-5-max",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/claude-opus-5-xhigh",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 43.298969072165,
      "terminal-bench-2-1": 88.0149812734082,
      scicode: 55.671296296296305,
      "aa-lcr": 80.3333333333333,
      hle: 54.40222428174239,
      critpt: 27.7142857142857,
      "mmmu-pro": 83.9884393063584,
      "aa-omniscience": 35.3833333333333,
      "aa-omniscience-accuracy": 59.5,
      "aa-omniscience-hallucination-rate": 59.547325102880656,
      "aa-briefcase": 1629.57,
      "output-speed": 53.7139455466219,
      "time-to-first-answer-token": 34.4156091449999,
      "time-per-task": 507.13116035991413,
      "cost-per-task": 3.358563065365869
    }
  },
  {
    modelId: "claude-opus-5-max",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/claude-opus-5-high",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 44.7422680412371,
      "terminal-bench-2-1": 87.6404494382023,
      scicode: 55.4398148148148,
      "aa-lcr": 79,
      hle: 52.8266913809083,
      critpt: 28.2857142857143,
      "mmmu-pro": 82.4277456647399,
      "aa-omniscience": 33.7166666666667,
      "aa-omniscience-accuracy": 58.88333333333333,
      "aa-omniscience-hallucination-rate": 61.207944872314556,
      "aa-briefcase": 1562.53,
      "output-speed": 53.6165285393354,
      "time-to-first-answer-token": 21.201303012,
      "time-per-task": 402.23211366757664,
      "cost-per-task": 2.4436080878708295
    }
  },
  {
    modelId: "claude-opus-5-max",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/claude-opus-5-medium",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 38.5567010309278,
      "terminal-bench-2-1": 86.1423220973783,
      scicode: 51.5046296296296,
      "aa-lcr": 82,
      hle: 51.29749768303981,
      critpt: 26.8571428571429,
      "mmmu-pro": 81.6184971098266,
      "aa-omniscience": 31.0166666666667,
      "aa-omniscience-accuracy": 57.06666666666666,
      "aa-omniscience-hallucination-rate": 60.67546583850931,
      "aa-briefcase": 1446.08,
      "output-speed": 51.8978638641538,
      "time-to-first-answer-token": 6.0947237485,
      "time-per-task": 240.85065724982348,
      "cost-per-task": 1.3613662506367379
    }
  },
  {
    modelId: "claude-opus-5-max",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/claude-opus-5-low",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 30.309278350515502,
      "terminal-bench-2-1": 76.4044943820225,
      scicode: 49.189814814814795,
      "aa-lcr": 81.3333333333333,
      hle: 43.4198331788693,
      critpt: 23.1428571428571,
      "mmmu-pro": 79.8265895953757,
      "aa-omniscience": 28.55,
      "aa-omniscience-accuracy": 55.95,
      "aa-omniscience-hallucination-rate": 62.20204313280363,
      "aa-briefcase": 1222.68,
      "output-speed": 51.8483712367719,
      "time-to-first-answer-token": 2.38440376,
      "time-per-task": 118.06080588513952,
      "cost-per-task": 0.635750701884044
    }
  },
  {
    modelId: "claude-fable-5-1-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/claude-fable-5-1",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 47.2164948453608,
      "terminal-bench-2-1": 91.3857677902622,
      scicode: 63.078703703703695,
      "aa-lcr": 85.3333333333333,
      hle: 59.1288229842447,
      critpt: 29.714285714285698,
      "aa-omniscience": 43.45,
      "aa-omniscience-accuracy": 67.23333333333333,
      "aa-omniscience-hallucination-rate": 72.58392675483215,
      "aa-briefcase": 1665.82,
      "output-speed": 68.9553119798498,
      "time-to-first-answer-token": 273.6043141315,
      "time-per-task": 588.7615042006879,
      "cost-per-task": 6.116914552058163
    }
  },
  {
    modelId: "claude-fable-5-1-max",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/claude-fable-5-1-xhigh",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 45.7731958762887,
      "terminal-bench-2-1": 91.01123595505621,
      scicode: 60.8796296296296,
      "aa-lcr": 83,
      hle: 58.7117701575533,
      critpt: 31.1428571428571,
      "aa-omniscience": 42.3833333333333,
      "aa-omniscience-accuracy": 66.21666666666667,
      "aa-omniscience-hallucination-rate": 70.54760730143069,
      "aa-briefcase": 1657.44,
      "output-speed": 66.4300573890179,
      "time-to-first-answer-token": 109.542889102
    }
  },
  {
    modelId: "claude-fable-5-1-max",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/claude-fable-5-1-high",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 43.0927835051546,
      "terminal-bench-2-1": 89.8876404494382,
      scicode: 58.6805555555556,
      "aa-lcr": 83.6666666666667,
      hle: 55.9314179796108,
      critpt: 30.2857142857143,
      "aa-omniscience": 40.8,
      "aa-omniscience-accuracy": 64.93333333333334,
      "aa-omniscience-hallucination-rate": 68.8212927756654,
      "aa-briefcase": 1584.75,
      "output-speed": 56.0410274989044,
      "time-to-first-answer-token": 25.6727141595
    }
  },
  {
    modelId: "claude-fable-5-1-max",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/claude-fable-5-1-medium",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 41.0309278350515,
      "terminal-bench-2-1": 88.0149812734082,
      scicode: 56.3657407407407,
      "aa-lcr": 84.6666666666667,
      hle: 53.79981464318811,
      critpt: 29.1428571428571,
      "aa-omniscience": 37.6,
      "aa-omniscience-accuracy": 63.1,
      "aa-omniscience-hallucination-rate": 69.10569105691057,
      "aa-briefcase": 1537.86,
      "output-speed": 56.2165008611772,
      "time-to-first-answer-token": 18.6680366500001
    }
  },
  {
    modelId: "claude-fable-5-1-max",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/claude-fable-5-1-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 38.9690721649485,
      "terminal-bench-2-1": 85.0187265917603,
      scicode: 56.712962962963,
      "aa-lcr": 82.3333333333333,
      hle: 48.887859128823,
      critpt: 27.7142857142857,
      "aa-omniscience": 34.1333333333333,
      "aa-omniscience-accuracy": 60.23333333333334,
      "aa-omniscience-hallucination-rate": 65.63285834031852,
      "aa-briefcase": 1491.28,
      "output-speed": 54.5227680579972,
      "time-to-first-answer-token": 6.580276766
    }
  },
  {
    modelId: "gemini-3-8-flash-high",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-8-flash",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 44.948453608247405,
      "terminal-bench-2-1": 87.6404494382023,
      scicode: 56.5972222222222,
      "aa-lcr": 81.3333333333333,
      hle: 47.8220574606117,
      critpt: 18.2857142857143,
      "mmmu-pro": 85.606936416185,
      "aa-omniscience": 29.55,
      "aa-omniscience-accuracy": 54.6,
      "aa-omniscience-hallucination-rate": 55.17621145374449,
      "aa-briefcase": 1205.69,
      "output-speed": 253.723675602526,
      "time-to-first-answer-token": 9.79320876099999,
      "time-per-task": 218.0609226331452,
      "cost-per-task": 0.7379692847501259
    }
  },
  {
    modelId: "gemini-3-8-flash-high",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-8-flash-medium",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 45.7731958762887,
      "terminal-bench-2-1": 83.8951310861423,
      scicode: 55.0925925925926,
      "aa-lcr": 84,
      hle: 42.122335495829496,
      critpt: 12.285714285714299,
      "mmmu-pro": 84.2196531791908,
      "aa-omniscience": 28.5833333333333,
      "aa-omniscience-accuracy": 52.983333333333334,
      "aa-omniscience-hallucination-rate": 51.89649060616802,
      "output-speed": 246.333481828686,
      "time-to-first-answer-token": 8.293623561
    }
  },
  {
    modelId: "gemini-3-8-flash-high",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-8-flash-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 33.1958762886598,
      "terminal-bench-2-1": 83.1460674157303,
      scicode: 54.976851851851805,
      "aa-lcr": 80.6666666666667,
      hle: 37.0713623725672,
      critpt: 4,
      "mmmu-pro": 84.5086705202312,
      "aa-omniscience": 21.35,
      "aa-omniscience-accuracy": 52.21666666666667,
      "aa-omniscience-hallucination-rate": 64.59713986745727,
      "output-speed": 265.344814866857,
      "time-to-first-answer-token": 0.778575496000002
    }
  },
  {
    modelId: "grok-4-6-high",
    effort: "high",
    sourceUrl: "https://artificialanalysis.ai/models/grok-4-6",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 50.7216494845361,
      "terminal-bench-2-1": 88.38951310861421,
      scicode: 56.4814814814815,
      "aa-lcr": 80.3333333333333,
      hle: 42.9101019462465,
      critpt: 17.1428571428571,
      "enterprise-ops-gym-aa": 48.343777976723366,
      "aa-omniscience": 30.4833333333333,
      "aa-omniscience-accuracy": 48.233333333333334,
      "aa-omniscience-hallucination-rate": 34.28847392144237,
      "aa-briefcase": 1540.16,
      "output-speed": 62.826743593045,
      "time-to-first-answer-token": 52.437284699,
      "time-per-task": 451.981410018739,
      "cost-per-task": 1.253554997808662
    }
  },
  {
    modelId: "grok-4-6-high",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/grok-4-6-xhigh",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 43.298969072165,
      "terminal-bench-2-1": 88.0149812734082,
      scicode: 53.0092592592593,
      "aa-lcr": 81,
      hle: 44.0685820203893,
      critpt: 19.7142857142857,
      "aa-omniscience": 29.3166666666667,
      "aa-omniscience-accuracy": 43,
      "aa-omniscience-hallucination-rate": 24.005847953216374,
      "aa-briefcase": 1551.26,
      "output-speed": 63.6318904058141,
      "time-to-first-answer-token": 57.1888272234999
    }
  },
  {
    modelId: "grok-4-6-high",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/grok-4-6-medium",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 44.3298969072165,
      "terminal-bench-2-1": 84.2696629213483,
      scicode: 55.9027777777778,
      "aa-lcr": 81,
      hle: 42.122335495829496,
      critpt: 17.714285714285698,
      "aa-omniscience": 28,
      "aa-omniscience-accuracy": 41.93333333333334,
      "aa-omniscience-hallucination-rate": 23.99540757749713,
      "aa-briefcase": 1496.2,
      "output-speed": 62.1528632534975,
      "time-to-first-answer-token": 41.9357666995
    }
  },
  {
    modelId: "grok-4-6-high",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/grok-4-6-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 38.144329896907195,
      "terminal-bench-2-1": 75.2808988764045,
      scicode: 49.421296296296305,
      "aa-lcr": 80.6666666666667,
      hle: 27.6181649675626,
      critpt: 5.71428571428571,
      "aa-omniscience": 25.9,
      "aa-omniscience-accuracy": 43.28333333333333,
      "aa-omniscience-hallucination-rate": 30.649426976197475,
      "aa-briefcase": 1298.71,
      "output-speed": 56.5891310050683,
      "time-to-first-answer-token": 7.07100983000001
    }
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/muse-spark-1-3",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 52.371134020618605,
      "terminal-bench-2-1": 85.76779026217231,
      scicode: 58.3333333333333,
      "aa-lcr": 84.3333333333333,
      hle: 49.0732159406858,
      critpt: 24.8571428571429,
      "aa-omniscience": 24.9333333333333,
      "aa-omniscience-accuracy": 43.833333333333336,
      "aa-omniscience-hallucination-rate": 33.64985163204748,
      "aa-briefcase": 1560.67,
      "output-speed": 190.118239420238,
      "time-to-first-answer-token": 29.208173562097578,
      "time-per-task": 215.12304385927766,
      "cost-per-task": 0.9587870562431213
    }
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/muse-spark-1-3-xhigh",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 47.2164948453608,
      "terminal-bench-2-1": 85.3932584269663,
      scicode: 59.7222222222222,
      "aa-lcr": 83,
      hle: 47.451343836886004,
      critpt: 26,
      "mmmu-pro": 82.0231213872832,
      "aa-omniscience": 23.1166666666667,
      "aa-omniscience-accuracy": 41.516666666666666,
      "aa-omniscience-hallucination-rate": 31.46195497292676,
      "aa-briefcase": 1486.31,
      "output-speed": 135.156575397245,
      "time-to-first-answer-token": 60.93231507598519,
      "time-per-task": 257.28910260053993,
      "cost-per-task": 0.8398907914894004
    }
  },
  {
    modelId: "kimi-k3-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/kimi-k3",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 45.979381443299,
      "terminal-bench-2-1": 85.0187265917603,
      scicode: 59.4907407407407,
      "aa-lcr": 88.6666666666667,
      hle: 46.8952734012975,
      critpt: 23.4285714285714,
      "mmmu-pro": 80.52023121387279,
      "enterprise-ops-gym-aa": 45.329752312742464,
      "aa-omniscience": 19.7,
      "aa-omniscience-accuracy": 47.583333333333336,
      "aa-omniscience-hallucination-rate": 53.19554848966613,
      "aa-briefcase": 1501.64,
      "output-speed": 41.1496306176867,
      "time-to-first-answer-token": 52.534136689053355,
      "time-per-task": 864.8073217986445,
      "cost-per-task": 1.576438869982937
    }
  },
  {
    modelId: "kimi-k3-max",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/kimi-k3-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 41.6494845360825,
      "terminal-bench-2-1": 82.3970037453184,
      scicode: 52.662037037037,
      "aa-lcr": 79.3333333333333,
      hle: 24.976830398517098,
      critpt: 3.14285714285714,
      "mmmu-pro": 78.4971098265896,
      "aa-omniscience": 3.91666666666667,
      "aa-omniscience-accuracy": 45.75,
      "aa-omniscience-hallucination-rate": 77.11213517665131,
      "output-speed": 39.9149648909824,
      "time-to-first-answer-token": 53.83953365148055
    }
  },
  {
    modelId: "qwen3-8-27b",
    effort: "xhigh",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 48.041237113402104,
      "terminal-bench-2-1": 79.7752808988764,
      scicode: 46.6435185185185,
      "aa-lcr": 82,
      hle: 33.920296570899,
      critpt: 5.42857142857143,
      "mmmu-pro": 76.3005780346821,
      "enterprise-ops-gym-aa": 44.225604297224706,
      "aa-omniscience": -9.98333333333333,
      "aa-omniscience-accuracy": 15.583333333333332,
      "aa-omniscience-hallucination-rate": 30.286278381046394,
      "aa-briefcase": 1404.14,
      "output-speed": 44.0014038122235,
      "time-to-first-answer-token": 49.3945452945738,
      "time-per-task": 966.1944867750528,
      "cost-per-task": 0.5727355343819633
    }
  },
  {
    modelId: "qwen3-8-27b",
    effort: "medium",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-medium",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 47.4226804123711,
      "terminal-bench-2-1": 65.1685393258427,
      scicode: 39.0046296296296,
      "aa-lcr": 79.6666666666667,
      hle: 14.0871177015755,
      critpt: 0,
      "mmmu-pro": 74.1618497109827,
      "aa-omniscience": -36.15,
      "aa-omniscience-accuracy": 18.35,
      "aa-omniscience-hallucination-rate": 66.74831598285364,
      "output-speed": 52.7708424419091,
      "time-to-first-answer-token": 41.7790760621203
    }
  },
  {
    modelId: "qwen3-8-27b",
    effort: "low",
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-27b-low",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 32.1649484536082,
      "terminal-bench-2-1": 67.4157303370786,
      scicode: 40.046296296296305,
      "aa-lcr": 77.3333333333333,
      hle: 14.040778498609798,
      critpt: 0,
      "mmmu-pro": 73.757225433526,
      "aa-omniscience": -26.6666666666667,
      "aa-omniscience-accuracy": 17.133333333333333,
      "aa-omniscience-hallucination-rate": 52.85599356395817,
      "output-speed": 52.5592091373545,
      "time-to-first-answer-token": 41.92450124326472
    }
  },
  {
    modelId: "qwen3-8-max",
    effort: null,
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-max",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 51.340206185567006,
      "terminal-bench-2-1": 81.2734082397004,
      scicode: 53.2407407407407,
      "aa-lcr": 78.3333333333333,
      hle: 43.0491195551437,
      critpt: 20,
      "mmmu-pro": 82.3121387283237,
      "aa-omniscience": 3.4,
      "aa-omniscience-accuracy": 31.85,
      "aa-omniscience-hallucination-rate": 41.746148202494496,
      "aa-briefcase": 1394.96,
      "output-speed": 40.1960520620431,
      "time-to-first-answer-token": 52.108636818865996,
      "time-per-task": 795.8043831753286,
      "cost-per-task": 1.1876933515414076
    }
  },
  {
    modelId: "glm-5-3-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 50.3092783505155,
      "terminal-bench-2-1": 83.8951310861423,
      scicode: 59.0277777777778,
      "aa-lcr": 79.6666666666667,
      hle: 42.2613531047266,
      critpt: 19.1428571428571,
      "enterprise-ops-gym-aa": 36.436884512085946,
      "aa-omniscience": 14.3,
      "aa-omniscience-accuracy": 33.85,
      "aa-omniscience-hallucination-rate": 29.554043839758126,
      "aa-briefcase": 1520.09,
      "output-speed": 82.8545737460279,
      "time-to-first-answer-token": 26.23181602327321,
      "time-per-task": 447.79527164843677,
      "cost-per-task": 1.259358421641291
    }
  },
  {
    modelId: "glm-5-3-flash",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/glm-5-3-flash",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 47.2164948453608,
      "terminal-bench-2-1": 84.2696629213483,
      scicode: 51.6203703703704,
      "aa-lcr": 80,
      hle: 39.8517145505097,
      critpt: 15.4285714285714,
      "enterprise-ops-gym-aa": 33.21396598030439,
      "aa-omniscience": 7.46666666666667,
      "aa-omniscience-accuracy": 27.500000000000004,
      "aa-omniscience-hallucination-rate": 27.632183908045977,
      "aa-briefcase": 1460.68,
      "output-speed": 46.1130926849213,
      "time-to-first-answer-token": 44.89866443424736,
      "time-per-task": 931.3504376344944,
      "cost-per-task": 0.18254869918932465
    }
  },
  {
    modelId: "deepseek-v4-pro-max",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-pro",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 39.587628865979404,
      "terminal-bench-2-1": 78.65168539325839,
      scicode: 51.0416666666667,
      "aa-lcr": 80.3333333333333,
      hle: 41.0101946246525,
      critpt: 18,
      "enterprise-ops-gym-aa": 49.59713518352731,
      "aa-omniscience": 0.833333333333333,
      "aa-omniscience-accuracy": 49.1,
      "aa-omniscience-hallucination-rate": 94.8264571054355,
      "aa-briefcase": 1271.07,
      "output-speed": 67.1348550040061,
      "time-to-first-answer-token": 31.572114625330016,
      "time-per-task": 561.3396290588321,
      "cost-per-task": 0.3327779885359769
    }
  },
  {
    modelId: "deepseek-v4-flash-0731",
    effort: "max",
    sourceUrl: "https://artificialanalysis.ai/models/deepseek-v4-flash",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 39.381443298969096,
      "terminal-bench-2-1": 78.65168539325839,
      scicode: 50.3472222222222,
      "aa-lcr": 79.6666666666667,
      hle: 38.5542168674699,
      critpt: 16.5714285714286,
      "aa-omniscience": -14.2833333333333,
      "aa-omniscience-accuracy": 40.38333333333333,
      "aa-omniscience-hallucination-rate": 91.69695275370422,
      "aa-briefcase": 1264.7,
      "output-speed": 131.420725444775,
      "time-to-first-answer-token": 16.15469962988648,
      "time-per-task": 343.32836097964235,
      "cost-per-task": 0.1397446276128162
    }
  },
  {
    modelId: "qwen3-8-flash-next",
    effort: null,
    sourceUrl: "https://artificialanalysis.ai/models/qwen3-8-flash-next",
    estimatedIndex: true,
    scores: {
      "tau3-banking": 45.360824742268,
      "terminal-bench-2-1": 86.1423220973783,
      scicode: 50.578703703703695,
      "aa-lcr": 79.6666666666667,
      hle: 38.044485634847106,
      critpt: 11.1428571428571,
      "mmmu-pro": 79.7687861271676,
      "aa-omniscience": -9.71666666666667,
      "aa-omniscience-accuracy": 24.5,
      "aa-omniscience-hallucination-rate": 45.32008830022075,
      "output-speed": 80.1255847024846,
      "time-to-first-answer-token": 27.6094395014034
    }
  },
  {
    modelId: "minimax-m3",
    effort: null,
    sourceUrl: "https://artificialanalysis.ai/models/minimax-m3",
    estimatedIndex: false,
    scores: {
      "tau3-banking": 15.2577319587629,
      "terminal-bench-2-1": 65.1685393258427,
      scicode: 47.1064814814815,
      "aa-lcr": 83,
      hle: 38.9712696941613,
      critpt: 3.7142857142857104,
      "mmmu-pro": 78.5549132947977,
      "enterprise-ops-gym-aa": 32.10981796478663,
      "aa-omniscience": 1.35,
      "aa-omniscience-accuracy": 16.7,
      "aa-omniscience-hallucination-rate": 18.42737094837935,
      "aa-briefcase": 1101.15,
      "output-speed": 84.6381855555648,
      "time-to-first-answer-token": 25.1547486469301,
      "time-per-task": 366.1898505142743,
      "cost-per-task": 0.22940861923964795
    }
  }
];
var reasoningObservations = [
  ...aaReasoningRuns.flatMap((run) => Object.entries(run.scores).flatMap(([metricId, value]) => typeof value === "number" ? [{
    modelId: run.modelId,
    metricId,
    value,
    observationDate: "2026-09-05",
    sourceUrl: run.sourceUrl,
    reasoningBudget: run.effort ?? "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 5 configuration snapshot",
    notes: "Exact published configuration. HLE without tools; AA-LCR v1.1; MMMU-Pro AA 10-option. Task cost/time use current Index aggregates; latency is first answer token. " + (run.modelId === "claude-fable-5-1-max" ? "Fable uses the published fallback-assisted configuration. " : "") + (run.estimatedIndex ? "AA marks the overall Index estimated; only published numeric component results are imported." : "")
  }] : [])),
  ...[
    {
      modelId: "gpt-6-astra-max",
      metricId: "deepswe-1-1",
      value: 74.11504424778761,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_6_astra_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gemini-3-8-flash-high",
      metricId: "deepswe-1-1",
      value: 73.8255033557047,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gemini_3_8_flash_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "deepswe-1-1",
      value: 73.64864864864865,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_claude_opus_5_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "deepswe-1-1",
      value: 73.23008849557522,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_6_astra_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "deepswe-1-1",
      value: 73.23008849557522,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_6_astra_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "deepswe-1-1",
      value: 73.15436241610739,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_claude_opus_5_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "deepswe-1-1",
      value: 72.82850779510022,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_claude_opus_5_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "deepswe-1-1",
      value: 72.78761061946902,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_6_astra_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "deepswe-1-1",
      value: 72.66666666666667,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_sol_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gemini-3-8-flash-high",
      metricId: "deepswe-1-1",
      value: 71.01769911504425,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gemini_3_8_flash_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "deepswe-1-1",
      value: 70.73170731707317,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_sol_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "deepswe-1-1",
      value: 69.62305986696231,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_terra_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "deepswe-1-1",
      value: 69.40133037694012,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_sol_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "glm-5-3-max",
      metricId: "deepswe-1-1",
      value: 68.95787139689578,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_glm_5_3_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "deepswe-1-1",
      value: 68.90380313199105,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_claude_opus_5_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "kimi-k3-max",
      metricId: "deepswe-1-1",
      value: 68.51441241685144,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_kimi_k3_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "deepswe-1-1",
      value: 67.47787610619469,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_grok_4_6_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "deepswe-1-1",
      value: 67.1875,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_luna_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "deepswe-1-1",
      value: 67.03539823008849,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_6_astra_low",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "deepswe-1-1",
      value: 66.74057649667405,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_grok_4_6_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "deepswe-1-1",
      value: 65.18847006651885,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_grok_4_6_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "glm-5-3-flash",
      metricId: "deepswe-1-1",
      value: 63.39285714285714,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_glm_5_3_flash_max",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "deepswe-1-1",
      value: 61.06194690265486,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_sol_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "deepswe-1-1",
      value: 60.17699115044248,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_terra_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "deepswe-1-1",
      value: 58.12917594654788,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_claude_opus_5_low",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "qwen3-8-max",
      metricId: "deepswe-1-1",
      value: 57.46102449888642,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_qwen3_8_max_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "deepswe-1-1",
      value: 56.85840707964602,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_luna_xhigh",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "deepswe-1-1",
      value: 53.76106194690266,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_terra_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "deepswe-1-1",
      value: 45.35398230088495,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_sol_low",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "deepswe-1-1",
      value: 44.24778761061947,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_luna_high",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "deepswe-1-1",
      value: 41.648106904231625,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_grok_4_6_low",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "deepswe-1-1",
      value: 35.11111111111111,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_terra_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "deepswe-1-1",
      value: 24.053452115812917,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_terra_low",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "deepswe-1-1",
      value: 11.283185840707963,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_luna_medium",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "deepswe-1-1",
      value: 1.5486725663716814,
      observationDate: "2026-09-05",
      sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gpt_5_6_luna_low",
      notes: "4 repeated runs; official pass@1 fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-2",
      value: 42.5,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-2",
      value: 67.08,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-2",
      value: 85.42,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-2",
      value: 90,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-2",
      value: 92.5,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-2",
      value: 18.75,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-2",
      value: 37.5,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-2",
      value: 67.08,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-2",
      value: 74.17,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-2",
      value: 83.89999999999999,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-2",
      value: 5.140000000000001,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-2",
      value: 7.359999999999999,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-2",
      value: 29.310000000000002,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-2",
      value: 47.64,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-2",
      value: 59.540000000000006,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "arc-agi-2",
      value: 88.33,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; anthropic-claude-opus-5-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "arc-agi-2",
      value: 90.42,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; anthropic-claude-opus-5-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "kimi-k3-max",
      metricId: "arc-agi-2",
      value: 60.416666666666664,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; moonshot-kimi-k3-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "kimi-k3-max",
      metricId: "arc-agi-2",
      value: 55.00000000000001,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; moonshot-kimi-k3-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "kimi-k3-max",
      metricId: "arc-agi-2",
      value: 12.36111111111111,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; moonshot-kimi-k3-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-2",
      value: 67.08333333333333,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; xai-grok-4-6-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-2",
      value: 65.13888888888889,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; xai-grok-4-6-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-2",
      value: 61.25000000000001,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; xai-grok-4-6-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-2",
      value: 27.63888888888889,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; xai-grok-4-6-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-2",
      value: 95,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-2",
      value: 93.33333333333333,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-2",
      value: 92.08333333333333,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-2",
      value: 92.08333333333333,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-2",
      value: 85.41666666666666,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-3",
      value: 0.33,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-3",
      value: 1.0699999999999998,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-3",
      value: 2.15,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-3",
      value: 6.99,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-3",
      value: 7.779999999999999,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-sol-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-3",
      value: 0.01,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-3",
      value: 0.08,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-3",
      value: 0.49,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-3",
      value: 0.65,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-3",
      value: 0.8,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-terra-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-3",
      value: 0.16999999999999998,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-3",
      value: 0.16999999999999998,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-3",
      value: 0.1,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-3",
      value: 0.02,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-3",
      value: 0.18,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-5-6-luna-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "arc-agi-3",
      value: 30.159999999999997,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; anthropic-claude-opus-5-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-3",
      value: 2.11,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; xai-grok-4-6-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-3",
      value: 62.71280210060628,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "max",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-max",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-3",
      value: 59.342954091460555,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "xhigh",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-xhigh",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-3",
      value: 54.81905163612231,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "high",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-high",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-3",
      value: 38.58757449733784,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "medium",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-medium",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-3",
      value: 17.452190401133805,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      reasoningBudget: "low",
      reasoningMode: "reasoning",
      scaffoldOrHarness: "Official ARC Prize CoT evaluation; openai-gpt-6-astra-low",
      notes: "Exact release and published effort. Standard harness; provider-adapter variants excluded. Fraction converted to percent."
    }
  ]
];

// src/engine/reasoningConfigurations.ts
function observationEffort(observation) {
  if (observation.configurationEffort !== undefined)
    return observation.configurationEffort;
  const budget = observation.reasoningBudget?.trim().toLowerCase();
  if (!budget || /not published|unspecified|not established|standard configuration|best score at any effort|unknown/.test(budget))
    return null;
  if (observation.sourceUrl.includes("playground.roboflow.com"))
    return null;
  const named = /^(max|xhigh|high|medium|low)(?:\s*\(source\))?$/.exec(budget);
  if (named && observation.modelId.startsWith("deepseek-v4") && ["medium", "xhigh"].includes(named[1]))
    return "high";
  return named?.[1] ?? budget;
}
function matchesReasoningConfiguration(model, observation) {
  if (observation.reasoningMode && observation.reasoningMode !== (model.isReasoningModel ? "reasoning" : "non-reasoning"))
    return false;
  const config = model.reasoningConfiguration;
  if (!config)
    return true;
  if (observation.metricId === "blended-token-price")
    return true;
  const effort = observationEffort(observation);
  if (effort === null)
    return config.tier === "top" || config.tier === "single";
  return effort === config.effort;
}
function assignReasoningObservations(models, observations) {
  return observations.flatMap((observation) => models.flatMap((model) => {
    const config = model.reasoningConfiguration;
    if (observation.modelId !== model.id && observation.modelId !== config?.releaseId)
      return [];
    if (!matchesReasoningConfiguration(model, observation))
      return [];
    if (!config)
      return [observation];
    const effort = observationEffort(observation);
    return [{
      ...observation,
      modelId: model.id,
      effortAttribution: observation.metricId === "blended-token-price" ? "shared-price" : effort === null ? "assumed-top" : "explicit"
    }];
  }));
}

// src/data/calibrationReferences.ts
var calibrationReferences = {
  models: [
    {
      id: "claude-opus-4-6",
      name: "Claude Opus 4.6",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "claude-opus-4-7",
      name: "Claude Opus 4.7",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "claude-opus-4-8",
      name: "Claude Opus 4.8",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gpt-5-4",
      name: "GPT-5.4",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gpt-5-5",
      name: "GPT-5.5",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gemini-3-1-pro-preview",
      name: "Gemini 3.1 Pro Preview",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gpt-5-6-terra",
      name: "GPT-5.6 Terra",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gpt-5-6-luna-max",
      name: "GPT-5.6 Luna (2026-07-09)",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "grok-4-5",
      name: "Grok 4.5",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gpt-5-6-sol-max",
      name: "GPT-5.6 Sol",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "claude-opus-5-max",
      name: "Claude Opus 5",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "grok-4-6-high",
      name: "Grok 4.6",
      isReasoningModel: true,
      visionInput: "unknown"
    },
    {
      id: "gpt-6-astra-max",
      name: "GPT-6 Astra",
      isReasoningModel: true,
      visionInput: "unknown"
    }
  ],
  observations: [
    {
      modelId: "claude-opus-4-6",
      metricId: "arc-agi-2",
      value: 69.17,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "120K, High",
      reasoningMode: "reasoning",
      notes: "Official row claude-opus-4-6-thinking-120K-high; source score 0.6917 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-4-6",
      metricId: "arc-agi-3",
      value: 0.51,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row anthropic-opus-4-6-max-effort; source score 0.0051 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-4-7",
      metricId: "arc-agi-2",
      value: 75.83,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row claude-4-7-max; source score 0.7583 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-4-7",
      metricId: "arc-agi-3",
      value: 0.18,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row anthropic-opus-4-7-high; source score 0.0018 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-4-8",
      metricId: "arc-agi-2",
      value: 72.08,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row anthropic-opus-4-8-high; source score 0.7208 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-4-8",
      metricId: "arc-agi-3",
      value: 1.52,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row anthropic-opus-4-8-high; source score 0.0152 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-4",
      metricId: "arc-agi-2",
      value: 73.95,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "XHigh",
      reasoningMode: "reasoning",
      notes: "Official row gpt-5-4-xhigh; source score 0.7395 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-4",
      metricId: "arc-agi-3",
      value: 0.21,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-4-2026-03-05-high; source score 0.0021 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-5",
      metricId: "arc-agi-2",
      value: 85,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "XHigh",
      reasoningMode: "reasoning",
      notes: "Official row gpt-5-5-2026-04-22-thinking-xhigh; source score 0.85 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-5",
      metricId: "arc-agi-3",
      value: 0.43,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-5-2026-04-23-high; source score 0.0043 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gemini-3-1-pro-preview",
      metricId: "arc-agi-2",
      value: 77.08,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Not published",
      reasoningMode: "reasoning",
      notes: "Official row gemini-3-1-pro-preview; source score 0.7708 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gemini-3-1-pro-preview",
      metricId: "arc-agi-3",
      value: 0.42,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Not published",
      reasoningMode: "reasoning",
      notes: "Official row google-gemini-3-1-pro-preview; source score 0.0042 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-2",
      value: 83.89999999999999,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-6-terra-max; source score 0.839 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-6-terra",
      metricId: "arc-agi-3",
      value: 0.8,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-6-terra-max; source score 0.008 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-2",
      value: 59.540000000000006,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-6-luna-max; source score 0.5954 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT. Original July 9 release; July 30 refresh is a separate release."
    },
    {
      modelId: "gpt-5-6-luna-max",
      metricId: "arc-agi-3",
      value: 0.18,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-6-luna-max; source score 0.0018 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT. Original July 9 release; July 30 refresh is a separate release."
    },
    {
      modelId: "grok-4-5",
      metricId: "arc-agi-2",
      value: 52.64,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row xai-grok-4-5-high; source score 0.5264 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "grok-4-5",
      metricId: "arc-agi-3",
      value: 0.32,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Medium",
      reasoningMode: "reasoning",
      notes: "Official row xai-grok-4-5-medium; source score 0.0032 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-2",
      value: 92.5,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-6-sol-max; source score 0.925 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-5-6-sol-max",
      metricId: "arc-agi-3",
      value: 7.779999999999999,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-5-6-sol-max; source score 0.0778 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "arc-agi-2",
      value: 90.42,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row anthropic-claude-opus-5-max; source score 0.9042 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "claude-opus-5-max",
      metricId: "arc-agi-3",
      value: 30.159999999999997,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "High",
      reasoningMode: "reasoning",
      notes: "Official row anthropic-claude-opus-5-high; source score 0.3016 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-2",
      value: 67.08333333333333,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "XHigh",
      reasoningMode: "reasoning",
      notes: "Official row xai-grok-4-6-xhigh; source score 0.6708333333333333 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "grok-4-6-high",
      metricId: "arc-agi-3",
      value: 2.11,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "XHigh",
      reasoningMode: "reasoning",
      notes: "Official row xai-grok-4-6-xhigh; source score 0.0211 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-2",
      value: 95,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v2.json",
      scaffoldOrHarness: "ARC Prize verified semi-private evaluation",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-6-astra-max; source score 0.95 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    },
    {
      modelId: "gpt-6-astra-max",
      metricId: "arc-agi-3",
      value: 62.71280210060628,
      observationDate: "2026-09-05",
      sourceUrl: "https://arcprize.org/media/data/leaderboard/v3.json",
      scaffoldOrHarness: "ARC Prize Standard harness; semi-private",
      reasoningBudget: "Max",
      reasoningMode: "reasoning",
      notes: "Official row openai-gpt-6-astra-max; source score 0.6271280210060628 converted from fraction to percent. Best eligible numeric result across published effort levels; modelType CoT."
    }
  ]
};

// src/engine/pricing.ts
var TOKEN_PRICE_BLEND = { cachedInput: 0.7, input: 0.2, output: 0.1 };
function blendTokenPrice(rates) {
  return rates.cachedInput * TOKEN_PRICE_BLEND.cachedInput + rates.input * TOKEN_PRICE_BLEND.input + rates.output * TOKEN_PRICE_BLEND.output;
}

// src/data/tokenPricing.ts
var tokenPricing = [
  {
    modelId: "gemini-3-1-pro-preview",
    input: 2,
    cachedInput: 0.2,
    output: 12,
    observationDate: "2026-09-06",
    sourceUrls: [
      "https://artificialanalysis.ai/models/gemini-3-1-pro-preview"
    ],
    pricingContext: "Google first-party API, standard short-context tier as reported by AA",
    notes: "USD per million tokens: input 2, cached input 0.2, output 12. Higher long-context tiers are not blended into this rate."
  },
  {
    modelId: "qwen3-8-max-0902",
    input: 2,
    cachedInput: 0.25,
    output: 6,
    sourceUrls: [
      "https://www.qwencloud.com/models/qwen3.8-max-0902"
    ],
    pricingContext: "QwenCloud first-party API, international/Singapore list tier, implicit cache hit",
    notes: "Exact 0902 snapshot/alias page. Explicit cache read is $0.17, but implicit cache ($0.25) is used because it is the ordinary automatic cache-hit tier and matches the AA convention for Alibaba.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "glm-5-3-flash",
    input: 0.15,
    cachedInput: 0.03,
    output: 0.5,
    sourceUrls: [
      "https://artificialanalysis.ai/models/glm-5-3-flash/",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Z AI first-party API rates represented by Artificial Analysis",
    notes: "AA directly displays the current 7:2:1 blended price as $0.10; component arithmetic is $0.101.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "qwen3-8-max",
    input: 2,
    cachedInput: 0.25,
    output: 6,
    sourceUrls: [
      "https://artificialanalysis.ai/models/qwen3-8-max",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Alibaba Cloud first-party API, implicit cache hit",
    notes: "Original August 3 release. AA directly displays current 7:2:1 blended price as $1.18.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "deepseek-v4-flash-0731",
    input: 0.44,
    cachedInput: 0.014,
    output: 1.32,
    sourceUrls: [
      "https://api-docs.deepseek.com/quick_start/pricing/",
      "https://artificialanalysis.ai/models/deepseek-v4-flash/"
    ],
    pricingContext: "DeepSeek first-party API, peak tier",
    notes: "Official table identifies exact DeepSeek-V4-Flash-0731 rates. AA directly displays current 7:2:1 blended price as $0.23. Off-peak rates were not mixed in.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "gpt-5-6-terra",
    input: 2,
    cachedInput: 0.2,
    output: 12,
    sourceUrls: [
      "https://artificialanalysis.ai/models/gpt-5-6-terra"
    ],
    pricingContext: "OpenAI first-party API standard tier",
    notes: "AA shows a 90% cache discount and directly displays current 7:2:1 blended price as $1.74.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "minimax-m3",
    input: 0.3,
    cachedInput: 0.06,
    output: 1.2,
    sourceUrls: [
      "https://artificialanalysis.ai/models/minimax-m3",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "MiniMax first-party API with explicit cache_control",
    notes: "AA directly displays current 7:2:1 blended price as $0.22. Cache-write pricing is separate and excluded from the requested blend.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "qwen3-8-27b",
    input: 0.5,
    cachedInput: 0.05,
    output: 3,
    sourceUrls: [
      "https://artificialanalysis.ai/models/qwen3-8-27b",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Alibaba Cloud first-party hosted API, explicit cache-read rate",
    notes: "Open-weight release priced through Alibaba's coherent hosted endpoint. AA directly displays current 7:2:1 blend as $0.43; exact component arithmetic is $0.435.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "claude-fable-5-1-max",
    input: 10,
    cachedInput: 0.25,
    output: 50,
    sourceUrls: [
      "https://artificialanalysis.ai/models/claude-fable-5-1",
      "https://artificialanalysis.ai/models/caching",
      "https://artificialanalysis.ai/articles/claude-fable-5-1"
    ],
    pricingContext: "Anthropic first-party API; exact Fable 5.1 default-fallback release",
    notes: "AA directly displays current 7:2:1 blended price as $7.17. Fable 5.1's $0.25 cache-hit rate is release-specific and lower than Fable 5's $1.00. Fallback execution is part of this exact catalog identity.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "claude-opus-5-max",
    input: 5,
    cachedInput: 0.5,
    output: 25,
    sourceUrls: [
      "https://artificialanalysis.ai/models/claude-opus-5",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Anthropic first-party API, adaptive reasoning max",
    notes: "AA directly displays current 7:2:1 blended price as $3.85.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "gpt-6-astra-max",
    input: 10,
    cachedInput: 1,
    output: 50,
    sourceUrls: [
      "https://artificialanalysis.ai/models/gpt-6-astra",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "OpenAI first-party API standard tier, max effort",
    notes: "AA directly displays current 7:2:1 blended price as $7.70.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "grok-4-6-high",
    input: 2,
    cachedInput: 0.5,
    output: 6,
    sourceUrls: [
      "https://artificialanalysis.ai/models/grok-4-6",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "SpaceXAI first-party API, high effort",
    notes: "AA directly displays current 7:2:1 blended price as $1.35. Prompt cache hits are not guaranteed by the provider.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    input: 1.25,
    cachedInput: 0.15,
    output: 4.25,
    sourceUrls: [
      "https://artificialanalysis.ai/models/muse-spark-1-3-xhigh/",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Meta first-party API, xhigh effort",
    notes: "AA directly displays current 7:2:1 blended price as $0.78.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "kimi-k3-max",
    input: 3,
    cachedInput: 0.3,
    output: 15,
    sourceUrls: [
      "https://artificialanalysis.ai/models/kimi-k3/",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Kimi first-party API, max effort",
    notes: "AA directly displays current 7:2:1 blended price as $2.31; no cross-provider minima were mixed.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "glm-5-3-max",
    input: 1.4,
    cachedInput: 0.26,
    output: 4.4,
    sourceUrls: [
      "https://artificialanalysis.ai/models/glm-5-3/",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "Z AI first-party API, max effort",
    notes: "AA directly displays current 7:2:1 blended price as $0.90. First-party Z AI components are used, not cheaper legs from other hosts.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "gemini-3-8-flash-high",
    input: 0.75,
    cachedInput: 0.075,
    output: 3.75,
    sourceUrls: [
      "https://artificialanalysis.ai/models/gemini-3-8-flash/",
      "https://artificialanalysis.ai/models/gemini-3-8-flash/providers"
    ],
    pricingContext: "Google AI Studio first-party API, high effort",
    notes: "AA shows a 90% cache discount and directly displays current 7:2:1 blended price as $0.58.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "deepseek-v4-pro-max",
    input: 1.32,
    cachedInput: 0.044,
    output: 3.96,
    sourceUrls: [
      "https://api-docs.deepseek.com/quick_start/pricing/",
      "https://artificialanalysis.ai/models/deepseek-v4-pro",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "DeepSeek first-party API, peak tier, max effort",
    notes: "Official table identifies exact DeepSeek-V4-Pro-0813 rates. AA displays the current 7:2:1 blend as $0.69. Off-peak rates and cheaper third-party providers were not mixed in.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "gpt-5-6-luna-max",
    input: 0.2,
    cachedInput: 0.02,
    output: 1.2,
    sourceUrls: [
      "https://artificialanalysis.ai/models/gpt-5-6-luna/"
    ],
    pricingContext: "OpenAI first-party API standard tier, max effort",
    notes: "AA shows a 90% cache discount and directly displays current 7:2:1 blended price as $0.17.",
    observationDate: "2026-09-05"
  },
  {
    modelId: "gpt-5-6-sol-max",
    input: 4,
    cachedInput: 0.4,
    output: 20,
    sourceUrls: [
      "https://artificialanalysis.ai/models/gpt-5-6-sol",
      "https://artificialanalysis.ai/models/caching"
    ],
    pricingContext: "OpenAI first-party API standard tier, max effort",
    notes: "AA directly displays current 7:2:1 blended price as $3.08.",
    observationDate: "2026-09-05"
  }
];
var tokenPriceObservations = tokenPricing.map((rates) => ({
  modelId: rates.modelId,
  metricId: "blended-token-price",
  value: blendTokenPrice(rates),
  observationDate: rates.observationDate,
  sourceUrl: rates.sourceUrls[0],
  scaffoldOrHarness: "Artificial Analysis 7:2:1 cache-hit/input/output price blend",
  reasoningBudget: "Not published",
  notes: `USD per 1M tokens: cached input $${String(rates.cachedInput)}, uncached input $${String(rates.input)}, output $${String(rates.output)}. ${rates.pricingContext}. ${rates.notes} Sources: ${rates.sourceUrls.join(", ")}. Cache creation and storage charges are outside this blend.`
}));

// src/data/gemini31Observations.ts
var gemini31Observations = [
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "automationbench",
    value: 8.68,
    observationDate: "2026-09-06",
    sourceUrl: "https://zapier.com/benchmarks",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; held-out private set; strict task_completed_correctly",
    notes: "Expanded official leaderboard; exact named effort. Published workload cost per task $0.30 is AutomationBench-specific and is not substituted for AA task cost."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "automationbench",
    value: 7,
    observationDate: "2026-09-06",
    sourceUrl: "https://zapier.com/benchmarks",
    reasoningBudget: "medium",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; held-out private set; strict task_completed_correctly",
    notes: "Expanded official leaderboard; exact named effort. Published workload cost per task $0.25 is AutomationBench-specific and is not substituted for AA task cost."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "automationbench",
    value: 4.57,
    observationDate: "2026-09-06",
    sourceUrl: "https://zapier.com/benchmarks",
    reasoningBudget: "low",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Zapier AutomationBench 1.0.6; held-out private set; strict task_completed_correctly",
    notes: "Expanded official leaderboard; exact named effort. Published workload cost per task $0.28 is AutomationBench-specific and is not substituted for AA task cost."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "tau3-banking",
    value: 21.4432989690722,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "terminal-bench-2-1",
    value: 73.78277153558051,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "scicode",
    value: 58.6805555555556,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "aa-lcr",
    value: 82,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "hle",
    value: 47.0342910101946,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "critpt",
    value: 17.714285714285698,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "mmmu-pro",
    value: 82.4277456647399,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "enterprise-ops-gym-aa",
    value: 42.166517457475386,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "aa-omniscience",
    value: 31.8833333333333,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "aa-omniscience-accuracy",
    value: 54.85,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "aa-omniscience-hallucination-rate",
    value: 50.86747877445552,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "aa-briefcase",
    value: 465.37,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "output-speed",
    value: 117.557921205492,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "time-to-first-answer-token",
    value: 26.3157180999999,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "time-per-task",
    value: 113.6879051099154,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "cost-per-task",
    value: 0.33503368841662706,
    observationDate: "2026-09-06",
    sourceUrl: "https://artificialanalysis.ai/models/gemini-3-1-pro-preview",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Artificial Analysis independent evaluation; September 6 model-page snapshot",
    notes: "Native effort not identified on this AA entry; Top-only assumption. Raw numeric components only. Task cost/time use AA Index workload; time excludes initial-token delay and overhead."
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "deepswe-1-1",
    value: 11.725663716814159,
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "mini-swe-agent; mini_swe_agent_gemini_3_1_pro_preview_high",
    notes: "Pass@1; 53 successes in 452 attempts over 113 tasks, four repeated runs. Do not substitute pass@4 or duration for AA task time.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "baby-vision",
    value: 51.6,
    sourceUrl: "https://www.unipat.ai/benchmarks/BabyVision",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Official BabyVision leaderboard; Gemini-3.1-Pro",
    notes: "No tool-assisted label or effort setting published for this row.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "roboflow-visual-reasoning",
    value: 74.8,
    sourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Roboflow Visual Reasoning high tier; ground-truth accuracy",
    notes: "Single run. Native setting not independently mapped; existing Top-only policy applies. Low-tier 72.2 is archived in the research report, not imported into the high-tier metric.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "swe-atlas-qna",
    value: 13.5,
    sourceUrl: "https://labs.scale.com/leaderboard/sweatlas-qna",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Mini-SWE-Agent; strict rubric threshold 1.0",
    notes: "Official Gemini 3.1 Pro row; published interval +/-3.9.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "arena-text-multi-turn",
    value: 1495,
    sourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Anonymous multi-turn text battles",
    notes: "Gemini-3.1-pro-preview; +/-6, 17842 votes. Unspecified effort is Top-only.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "agent-arena",
    value: -3.73,
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Arena Agent Mode; overall category; causal net improvement",
    notes: "September 5 leaderboard; 84469 sessions, +/-0.94 pp. Negative sign verified in source HTML aria-label Net improvement -3.73%, not text-only magnitude.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "agent-arena-praise-vs-complaint",
    value: 1.11,
    sourceUrl: "https://arena.ai/leaderboard/agent",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Arena Agent Mode; overall category; causal praise-minus-complaint effect",
    notes: "September 5 leaderboard; +/-2.79 pp. Positive sign verified in source HTML.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "osworld-verified",
    value: 78.34,
    sourceUrl: "https://osworld-v1.xlang.ai/static/data/osworld_verified_results.xlsx",
    reasoningBudget: "Not published",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "OpenAPA with Gemini 3.1 Pro; 100 steps; coding actions; no a11y tree or multiple rollout",
    notes: "Official spreadsheet reports 282.8/361, rather than the full 369-task denominator; preserve this harness/subset caveat. OSWorld 2.0 has no Gemini 3.1 result.",
    observationDate: "2026-09-06"
  },
  {
    modelId: "gemini-3-1-pro-preview",
    metricId: "scicode",
    value: 59,
    sourceUrl: "https://deepmind.google/models/model-cards/gemini-3-1-pro/",
    reasoningBudget: "high",
    reasoningMode: "reasoning",
    scaffoldOrHarness: "Google model-card evaluation",
    notes: "Rounded vendor result; compatible SciCode scientific research coding.",
    observationDate: "2026-09-06"
  }
];

// src/data/observations.ts
var AA_OBSERVATION_DATE = "2026-09-04";
var TERMINAL_BENCH_V4_URL = "https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/latest?leaderboard=4-0-0&tab=leaderboard";
var AA_TAU_URL = "https://artificialanalysis.ai/evaluations/tau3-banking";
var AA_SCICODE_URL = "https://artificialanalysis.ai/evaluations/scicode";
var AA_HLE_URL = "https://artificialanalysis.ai/evaluations/humanitys-last-exam";
var AA_OMNISCIENCE_URL = "https://artificialanalysis.ai/evaluations/omniscience";
var AA_CRITPT_URL = "https://artificialanalysis.ai/evaluations/critpt";
var currentAAModels = [
  {
    modelId: "claude-fable-5-1-max",
    modelUrl: "https://artificialanalysis.ai/models/claude-fable-5-1",
    tau: 47.2165,
    scicode: 62.037,
    hle: 59.1288,
    critpt: 29.7143,
    omniscience: 43.45,
    omniscienceAccuracy: 67.2333,
    omniscienceHallucinationRate: 72.5839,
    outputSpeed: 66.4457,
    timeToFirstAnswerToken: 282.3394,
    taskCost: 3.6891
  },
  {
    modelId: "claude-opus-5-max",
    modelUrl: "https://artificialanalysis.ai/models/claude-opus-5",
    tau: 42.0619,
    scicode: 55.6713,
    hle: 54.8656,
    critpt: 29.1429,
    omniscience: 37.0667,
    omniscienceAccuracy: 60.8667,
    omniscienceHallucinationRate: 60.8177,
    outputSpeed: 59.0843,
    timeToFirstAnswerToken: 91.1986,
    taskCost: 2.3369
  },
  {
    modelId: "gpt-6-astra-max",
    modelUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    tau: 41.4433,
    scicode: 54.0509,
    hle: 54.6803,
    critpt: 31.7143,
    omniscience: 43.4,
    omniscienceAccuracy: 62.6,
    omniscienceHallucinationRate: 51.337,
    taskCost: 1.6741
  },
  {
    modelId: "grok-4-6-high",
    modelUrl: "https://artificialanalysis.ai/models/grok-4-6",
    tau: 50.7216,
    scicode: 53.588,
    hle: 42.9101,
    critpt: 17.1429,
    omniscience: 30.4833,
    omniscienceAccuracy: 48.2333,
    omniscienceHallucinationRate: 34.2885,
    outputSpeed: 65.023,
    timeToFirstAnswerToken: 52.1604,
    taskCost: 0.9372
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    modelUrl: "https://artificialanalysis.ai/models/muse-spark-1-3-xhigh",
    tau: 47.2165,
    scicode: 58.5648,
    hle: 47.4513,
    critpt: 26,
    omniscience: 23.1167,
    omniscienceAccuracy: 41.5167,
    omniscienceHallucinationRate: 31.462,
    outputSpeed: 149.9072,
    timeToFirstAnswerToken: 42.4863,
    taskCost: 0.547
  },
  {
    modelId: "kimi-k3-max",
    modelUrl: "https://artificialanalysis.ai/models/kimi-k3",
    tau: 45.9794,
    scicode: 58.6806,
    hle: 46.8953,
    critpt: 23.4286,
    omniscience: 19.7,
    omniscienceAccuracy: 47.5833,
    omniscienceHallucinationRate: 53.1955,
    outputSpeed: 39.5571,
    timeToFirstAnswerToken: 4.8924,
    taskCost: 0.8375
  },
  {
    modelId: "glm-5-3-max",
    modelUrl: "https://artificialanalysis.ai/models/glm-5-3",
    tau: 50.3093,
    scicode: 56.4815,
    hle: 42.2614,
    critpt: 19.1429,
    omniscience: 14.3,
    omniscienceAccuracy: 33.85,
    omniscienceHallucinationRate: 29.554,
    outputSpeed: 84.1788,
    timeToFirstAnswerToken: 2.0095,
    taskCost: 0.6829
  },
  {
    modelId: "gemini-3-8-flash-high",
    modelUrl: "https://artificialanalysis.ai/models/gemini-3-8-flash",
    tau: 44.9485,
    scicode: 53.588,
    hle: 47.8221,
    critpt: 18.2857,
    omniscience: 29.55,
    omniscienceAccuracy: 54.6,
    omniscienceHallucinationRate: 55.1762,
    outputSpeed: 397.5602,
    timeToFirstAnswerToken: 13.2057,
    taskCost: 0.5766
  },
  {
    modelId: "deepseek-v4-pro-max",
    modelUrl: "https://artificialanalysis.ai/models/deepseek-v4-pro",
    tau: 39.5876,
    scicode: 49.1898,
    hle: 41.0102,
    critpt: 18,
    omniscience: 0.8333,
    omniscienceAccuracy: 49.1,
    omniscienceHallucinationRate: 94.8265,
    outputSpeed: 62.4088,
    timeToFirstAnswerToken: 1.7627,
    taskCost: 0.2653
  },
  {
    modelId: "gpt-5-6-luna-max",
    modelUrl: "https://artificialanalysis.ai/models/gpt-5-6-luna",
    tau: 31.134,
    scicode: 52.5463,
    hle: 39.481,
    critpt: 20.5714,
    omniscience: -10.2833,
    omniscienceAccuracy: 42.7333,
    omniscienceHallucinationRate: 92.5786,
    outputSpeed: 133.9052,
    timeToFirstAnswerToken: 169.6364,
    taskCost: 0.0487
  },
  {
    modelId: "gpt-5-6-sol-max",
    modelUrl: "https://artificialanalysis.ai/models/gpt-5-6-sol",
    tau: 44.3299,
    scicode: 56.1343,
    hle: 49.4903,
    critpt: 32.2857,
    omniscience: 21.9667,
    omniscienceAccuracy: 59.4,
    omniscienceHallucinationRate: 92.2003,
    outputSpeed: 85.4488,
    timeToFirstAnswerToken: 107.129,
    taskCost: 0.953
  }
];
var terminalBenchV4Observations = [
  {
    modelId: "claude-fable-5-1-max",
    metricId: "terminal-bench-v4",
    value: 57.88,
    observationDate: "2026-09-02",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "Claude Code",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "terminal-bench-v4",
    value: 58.18,
    observationDate: "2026-09-04",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "Codex",
    reasoningBudget: "max",
    notes: "Current Terminal-Bench 4.0 public snapshot; score is for the complete model-and-agent system."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "terminal-bench-v4",
    value: 51.82,
    observationDate: "2026-08-26",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "Claude Code",
    reasoningBudget: "max"
  },
  {
    modelId: "grok-4-6-high",
    metricId: "terminal-bench-v4",
    value: 20.3,
    observationDate: "2026-09-04",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "Grok Build",
    reasoningBudget: "high",
    notes: "Current Terminal-Bench 4.0 public snapshot; score is for the complete model-and-agent system."
  },
  {
    modelId: "glm-5-3-max",
    metricId: "terminal-bench-v4",
    value: 41.82,
    observationDate: "2026-08-26",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "Claude Code",
    reasoningBudget: "max"
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "terminal-bench-v4",
    value: 19.09,
    observationDate: "2026-09-01",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "high"
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "terminal-bench-v4",
    value: 17.27,
    observationDate: "2026-08-26",
    sourceUrl: TERMINAL_BENCH_V4_URL,
    scaffoldOrHarness: "Codex",
    reasoningBudget: "max"
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "terminal-bench-v4",
    value: 37.3,
    observationDate: "2026-06-26",
    sourceUrl: "https://snorkel.ai/leaderboard/terminal-bench-4-0/",
    scaffoldOrHarness: "Codex",
    reasoningBudget: "max",
    notes: "Secondary Terminal-Bench 4.0 leaderboard; the current official Harbor page exposes no server-rendered Sol row."
  }
];
var aaBenchmarkObservations = currentAAModels.flatMap((model) => {
  const provenance = {
    scaffoldOrHarness: "Artificial Analysis independent evaluation",
    reasoningBudget: "AA standard configuration"
  };
  return [
    {
      modelId: model.modelId,
      metricId: "tau3-banking",
      value: model.tau,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_TAU_URL,
      ...provenance
    },
    {
      modelId: model.modelId,
      metricId: "scicode",
      value: model.scicode,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_SCICODE_URL,
      ...provenance
    },
    {
      modelId: model.modelId,
      metricId: "hle",
      value: model.hle,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_HLE_URL,
      ...provenance
    },
    {
      modelId: model.modelId,
      metricId: "critpt",
      value: model.critpt,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_CRITPT_URL,
      ...provenance
    },
    {
      modelId: model.modelId,
      metricId: "aa-omniscience",
      value: model.omniscience,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_OMNISCIENCE_URL,
      ...provenance
    },
    {
      modelId: model.modelId,
      metricId: "aa-omniscience-accuracy",
      value: model.omniscienceAccuracy,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_OMNISCIENCE_URL,
      ...provenance
    },
    {
      modelId: model.modelId,
      metricId: "aa-omniscience-hallucination-rate",
      value: model.omniscienceHallucinationRate,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: AA_OMNISCIENCE_URL,
      ...provenance
    }
  ];
});
var aaPerformanceObservations = currentAAModels.flatMap((model) => {
  const observations = [];
  if (model.outputSpeed !== undefined) {
    observations.push({
      modelId: model.modelId,
      metricId: "output-speed",
      value: model.outputSpeed,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: model.modelUrl
    });
  }
  if (model.taskTime !== undefined) {
    observations.push({
      modelId: model.modelId,
      metricId: "time-per-task",
      value: model.taskTime,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: model.modelUrl
    });
  }
  if (model.timeToFirstAnswerToken !== undefined) {
    observations.push({
      modelId: model.modelId,
      metricId: "time-to-first-answer-token",
      value: model.timeToFirstAnswerToken,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: model.modelUrl
    });
  }
  if (model.taskCost !== undefined) {
    observations.push({
      modelId: model.modelId,
      metricId: "cost-per-task",
      value: model.taskCost,
      observationDate: AA_OBSERVATION_DATE,
      sourceUrl: model.modelUrl
    });
  }
  return observations;
});
var supplementalObservations = [
  {
    modelId: "gpt-6-astra-max",
    metricId: "output-speed",
    value: 63.3629,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    notes: "AA first-party API median output speed from the public model-page data (timescaleData.medianOutputSpeed)."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "time-per-task",
    value: 331.1924,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    notes: "AA Intelligence Index v4.2 weighted decode time in seconds from intelligenceIndexTimePerTask; excludes TTFT and overhead."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "time-to-first-answer-token",
    value: 317.2399,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/models/gpt-6-astra",
    notes: "AA public model-page timeToFirstAnswerToken.total in seconds; the source reports zero separate reasoning-time component for this API measurement."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "swe-atlas-qna",
    value: 36.5591,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/agents/coding-agents",
    scaffoldOrHarness: "Kimi Code CLI 0.26.0",
    reasoningBudget: "Not published",
    notes: "AA independent Kimi Code CLI - Kimi K3 row, SWE-Atlas-QnA mean reward 0.365591397849462 converted to percent. The source row does not label effort; the app variant is max."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "swe-atlas-qna",
    value: 37.9032,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/agents/coding-agents",
    scaffoldOrHarness: "Opencode 1.18.18",
    reasoningBudget: "high",
    notes: "AA independent Opencode - Gemini 3.8 Flash (high) row, SWE-Atlas-QnA mean reward 0.379032258064516 converted to percent. Google separately reports 51.9% as SWE-Atlas without a harness or effort label in its developer guide; this observation uses the explicit high-effort independent run."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "swe-atlas-qna",
    value: 32.7957,
    observationDate: "2026-09-05",
    sourceUrl: "https://artificialanalysis.ai/agents/coding-agents",
    scaffoldOrHarness: "Codex 0.141.0",
    reasoningBudget: "max",
    notes: "AA independent Codex - GPT-5.6 Luna (max) row, SWE-Atlas-QnA mean reward 0.327956989247312 converted to percent."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "baby-vision",
    value: 85.7,
    observationDate: "2026-07-14",
    sourceUrl: "https://unipat.ai/benchmarks/BabyVision",
    scaffoldOrHarness: "Python tools",
    reasoningBudget: "Not published",
    notes: "Direct BabyVision leaderboard row for Kimi K3; the source configuration uses Python tools and does not publish the app variant's max-effort setting."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "baby-vision",
    value: 88.9,
    observationDate: "2026-06-26",
    sourceUrl: "https://unipat.ai/benchmarks/BabyVision",
    scaffoldOrHarness: "Tools",
    reasoningBudget: "max",
    notes: "Direct BabyVision leaderboard row for GPT-5.6 Sol (max) with tools."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "deepswe-1-1",
    value: 72.67,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 327 passed attempts out of 450 (72.6667% pass@1)."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "swe-atlas-qna",
    value: 46,
    observationDate: "2026-09-04",
    sourceUrl: "https://labs.scale.com/leaderboard/sweatlas-qna",
    scaffoldOrHarness: "Codex",
    reasoningBudget: "xhigh (source)",
    notes: "Scale publishes GPT-5.6-Sol (Codex) xHigh at 46.00%; source notes elevated refusals caused by security filters, with failures scored 0. The app variant is max."
  },
  {
    modelId: "gpt-5-6-sol-max",
    metricId: "arc-agi-3",
    value: 7.78,
    observationDate: "2026-07-09",
    sourceUrl: "https://arcprize.org/results/openai-gpt-5-6",
    scaffoldOrHarness: "ARC Prize Standard harness",
    reasoningBudget: "max",
    notes: "Verified ARC Prize standard-harness result for Sol Max."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "deepswe-1-1",
    value: 73.23,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 331 passed attempts out of 452 (73.2301% pass@1)."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "swe-atlas-qna",
    value: 51,
    observationDate: "2026-09-04",
    sourceUrl: "https://artificialanalysis.ai/agents/coding-agents/comparisons/codex-vs-cursor-cli",
    scaffoldOrHarness: "Codex",
    reasoningBudget: "max",
    notes: "Artificial Analysis coding-agent comparison lists an exact GPT-6 Astra (max) row; score is the Codex-agent SWE-Atlas-QnA result."
  },
  {
    modelId: "gpt-6-astra-max",
    metricId: "arc-agi-3",
    value: 62.71,
    observationDate: "2026-09-02",
    sourceUrl: "https://arcprize.org/results/openai-gpt-6-astra",
    scaffoldOrHarness: "ARC Prize Standard harness",
    reasoningBudget: "max",
    notes: "Verified ARC Prize standard-harness result; the separate Provider Adapter harness reports 98.55% and is not substituted here."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "deepswe-1-1",
    value: 73.65,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 327 passed attempts out of 444 (73.6486% pass@1)."
  },
  {
    modelId: "gemini-3-8-flash-high",
    metricId: "deepswe-1-1",
    value: 73.83,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "high",
    notes: "Exact current official JSON row: 330 passed attempts out of 447 (73.8255% pass@1)."
  },
  {
    modelId: "glm-5-3-max",
    metricId: "deepswe-1-1",
    value: 68.96,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 311 passed attempts out of 451 (68.9579% pass@1)."
  },
  {
    modelId: "kimi-k3-max",
    metricId: "deepswe-1-1",
    value: 68.51,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 309 passed attempts out of 451 (68.5144% pass@1)."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "deepswe-1-1",
    value: 65.19,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "high",
    notes: "Exact current official JSON row: 294 passed attempts out of 451 (65.1885% pass@1)."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "deepswe-1-1",
    value: 67.19,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 301 passed attempts out of 448 (67.1875% pass@1)."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "deepswe-1-1",
    value: 62.83,
    observationDate: "2026-09-03",
    sourceUrl: "https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json",
    scaffoldOrHarness: "mini-swe-agent",
    reasoningBudget: "max",
    notes: "Exact current official JSON row: 284 passed attempts out of 452 (62.8319% pass@1)."
  },
  {
    modelId: "deepseek-v4-pro-max",
    metricId: "swe-atlas-qna",
    value: 27.15,
    observationDate: "2026-07-28",
    sourceUrl: "https://labs.scale.com/leaderboard/sweatlas-qna",
    scaffoldOrHarness: "Mini-SWE-Agent",
    reasoningBudget: "Not published",
    notes: "The source row does not publish an effort level; the app model variant is max."
  },
  {
    modelId: "gpt-5-6-luna-max",
    metricId: "arc-agi-3",
    value: 0.2,
    observationDate: "2026-09-01",
    sourceUrl: "https://spectrumailab.com/tools/benchmarks",
    scaffoldOrHarness: "Official-source mirror",
    reasoningBudget: "Not published",
    notes: "Best available current secondary table; its ARC-AGI-3 value is identified as official-source data."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "deepswe-1-1",
    value: 67.4,
    observationDate: "2026-09-01",
    sourceUrl: "https://www-cdn.anthropic.com/0339e6a7c5c7b87f5c07798616dc32c215d14235/Claude%20Fable%205.1%20%26%20Claude%20Mythos%205.1%20System%20Card.pdf",
    scaffoldOrHarness: "Provider report; harness not published",
    reasoningBudget: "max",
    notes: "Exact Claude Fable 5.1 max-effort result from Anthropic's release system card; it is vendor-reported, not a Datacurve leaderboard run."
  },
  {
    modelId: "claude-fable-5-1-max",
    metricId: "swe-atlas-qna",
    value: 59.95,
    observationDate: "2026-09-04",
    sourceUrl: "https://labs.scale.com/leaderboard/sweatlas-qna",
    scaffoldOrHarness: "Claude Code",
    reasoningBudget: "xhigh (source)",
    notes: "Current Scale Labs Codebase QnA row for Fable-5.1. The source run is xHigh; the catalogued product is max."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "swe-atlas-qna",
    value: 63.17,
    observationDate: "2026-09-04",
    sourceUrl: "https://labs.scale.com/leaderboard/sweatlas-qna",
    scaffoldOrHarness: "Claude Code",
    reasoningBudget: "xhigh (source)",
    notes: "Current Scale Labs Codebase QnA row for Opus 5. The source run is xHigh; the catalogued product is max."
  },
  {
    modelId: "claude-opus-5-max",
    metricId: "arc-agi-3",
    value: 30.16,
    observationDate: "2026-07-24",
    sourceUrl: "https://www.anthropic.com/news/claude-opus-5",
    scaffoldOrHarness: "Anthropic ARC-AGI-3 evaluation harness",
    reasoningBudget: "high (source)",
    notes: "Anthropic's release chart reports 30.16% at high effort. Max was not evaluated in that release result."
  },
  {
    modelId: "grok-4-6-high",
    metricId: "arc-agi-3",
    value: 2.11,
    observationDate: "2026-09-04",
    sourceUrl: "https://htv3.arc-prize.com/leaderboard",
    scaffoldOrHarness: "ARC Prize official leaderboard harness",
    reasoningBudget: "xhigh (source)",
    notes: "Official ARC-AGI-3 leaderboard configuration is xHigh; the catalogued product is high."
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    metricId: "deepswe-1-1",
    value: 75.4,
    observationDate: "2026-09-02",
    sourceUrl: "https://benchlm.ai/models/muse-spark-1-3",
    scaffoldOrHarness: "Meta release scorecard",
    reasoningBudget: "max (source)",
    notes: "Provider-reported DeepSWE 1.1 result from Meta's launch scorecard. It has not yet appeared as a Datacurve public-leaderboard row."
  },
  {
    modelId: "muse-spark-1-3-xhigh",
    metricId: "swe-atlas-qna",
    value: 59.4,
    observationDate: "2026-09-02",
    sourceUrl: "https://benchlm.ai/models/muse-spark-1-3",
    scaffoldOrHarness: "Meta release scorecard",
    reasoningBudget: "max (source)",
    notes: "Provider-reported SWE-Atlas Codebase QnA result from Meta's launch scorecard."
  }
];
var aaNewBenchmarkObservations = [
  { modelId: "claude-fable-5-1-max", slug: "claude-fable-5-1", effort: "max", lcr: 85.3333, briefcase: 1665.82 },
  { modelId: "claude-opus-5-max", slug: "claude-opus-5", effort: "max", lcr: 79.3333, briefcase: 1650.28 },
  { modelId: "gpt-6-astra-max", slug: "gpt-6-astra", effort: "max", lcr: 80.6667, briefcase: 1565.51 },
  { modelId: "grok-4-6-high", slug: "grok-4-6", effort: "high", lcr: 80.3333, briefcase: 1540.16 },
  { modelId: "muse-spark-1-3-xhigh", slug: "muse-spark-1-3-xhigh", effort: "xhigh", lcr: 83, briefcase: 1486.31 },
  { modelId: "kimi-k3-max", slug: "kimi-k3", effort: "max", lcr: 88.6667, briefcase: 1501.64 },
  { modelId: "glm-5-3-max", slug: "glm-5-3", effort: "max", lcr: 79.6667, briefcase: 1520.09 },
  { modelId: "gemini-3-8-flash-high", slug: "gemini-3-8-flash", effort: "high", lcr: 81.3333, briefcase: 1205.69 },
  { modelId: "deepseek-v4-pro-max", slug: "deepseek-v4-pro", effort: "max", lcr: 80.3333, briefcase: 1271.07 },
  { modelId: "gpt-5-6-luna-max", slug: "gpt-5-6-luna", effort: "max", lcr: 83.6667, briefcase: 1344.66 },
  { modelId: "gpt-5-6-sol-max", slug: "gpt-5-6-sol", effort: "max", lcr: 84, briefcase: 1481.15 }
].flatMap((model) => {
  const provenance = {
    modelId: model.modelId,
    observationDate: "2026-09-05",
    sourceUrl: `https://artificialanalysis.ai/models/${model.slug}`,
    reasoningBudget: model.effort,
    notes: model.slug === "claude-fable-5-1" ? "AA reports the Default Fallback configuration; this is not a standalone Fable-only run." : model.slug === "deepseek-v4-pro" ? "DeepSeek V4 Pro 0813 release." : undefined
  };
  return [
    { ...provenance, metricId: "aa-lcr", value: model.lcr, scaffoldOrHarness: "AA-LCR v1.1; no tools; pass@1 averaged over three runs" },
    { ...provenance, metricId: "aa-briefcase", value: model.briefcase, scaffoldOrHarness: "AA Stirrup; 500-turn cap; combined Elo; September 5, 2026 snapshot" }
  ];
});
var releaseObservations = [
  ...gemini31Observations,
  ...tokenPriceObservations,
  ...reasoningObservations,
  ...supplementalModelObservations,
  ...qwenObservations,
  ...calibrationReferences.observations.filter((observation) => modelCatalog.some((model) => model.id === observation.modelId)),
  ...preferenceComputerObservations,
  ...coverageFallbackObservations,
  ...fallbackObservations,
  ...aaNewBenchmarkObservations,
  ...terminalBenchV4Observations,
  ...aaBenchmarkObservations,
  ...aaPerformanceObservations,
  ...supplementalObservations
];
var metricObservations = assignReasoningObservations(initialModels, releaseObservations);
// src/data/indexCatalog.json
var indexCatalog_default = {
  compositeMetrics: [
    {
      id: "composite-speed-score",
      version: "2026.2",
      kind: "composite",
      family: "speed",
      name: "Speed Score",
      description: "Leans primarily on Time per Intelligence Index Task from Artificial Analysis but also includes a small amount of Time to First Answer Token and Median Output Speed weight in order to reflect the user experience in more standard usage (e.g. not always solving intentionally complex problems)",
      components: [
        {
          metricId: "time-per-task",
          weight: 0.78
        },
        {
          metricId: "time-to-first-answer-token",
          weight: 0.12
        },
        {
          metricId: "output-speed",
          weight: 0.1
        }
      ]
    },
    {
      id: "composite-affordability-score",
      version: "2026.2",
      kind: "composite",
      family: "cost",
      name: "Affordability Score",
      description: "Shared AA workload reference: mostly task cost and a little bit fixed blended token price. Task cost is not measured on the selected capability mixture. This blend helps account for the fact that cost per task reflects particular types of tasks as from benchmarks instead of realistic day-to-day use.",
      components: [
        {
          metricId: "cost-per-task",
          weight: 0.9
        },
        {
          metricId: "blended-token-price",
          weight: 0.1
        }
      ]
    },
    {
      id: "real-coding-composite",
      version: "2026.2",
      kind: "composite",
      family: "quality",
      name: "Real Software Engineering Index",
      description: "Long-horizon engineering, architecting, and repository comprehension. ",
      components: [
        {
          metricId: "deepswe-1-1",
          weight: 0.2488488749365937
        },
        {
          metricId: "terminal-bench-v4",
          weight: 0.2488488749365937
        },
        {
          metricId: "swe-atlas-qna",
          weight: 0.18130418031094686
        },
        {
          metricId: "aa-omniscience-accuracy",
          weight: 0.08024951745396645
        },
        {
          metricId: "scicode",
          weight: 0.08024951745396645
        },
        {
          metricId: "baby-vision",
          weight: 0.08024951745396645
        },
        {
          metricId: "mmmu-pro",
          weight: 0.08024951745396645
        }
      ]
    },
    {
      id: "real-stem-composite",
      version: "2026.2",
      kind: "composite",
      family: "quality",
      name: "Real Reasoning & Knowledge Index",
      description: "Deep understanding and problem solving. Broad knowledge and reasoning capacity.",
      components: [
        {
          metricId: "hle",
          weight: 0.27666486206471946
        },
        {
          metricId: "scicode",
          weight: 0.07532604088988294
        },
        {
          metricId: "critpt",
          weight: 0.1375926854118652
        },
        {
          metricId: "aa-omniscience",
          weight: 0.14794912409878067
        },
        {
          metricId: "arc-agi-3",
          weight: 0.263114129724775
        },
        {
          metricId: "aa-briefcase",
          weight: 0.024027116920093815
        },
        {
          metricId: "aa-lcr",
          weight: 0.07532604088988294
        }
      ]
    },
    {
      id: "real-frontier-2026-custom-custom-composite",
      version: "2026.1",
      kind: "composite",
      family: "quality",
      name: "Real Frontier Index",
      description: "Overall Weighted Real Intelligence Index",
      components: [
        {
          metricId: "real-coding-composite",
          weight: 0.12209670879196223
        },
        {
          metricId: "real-stem-composite",
          weight: 0.12209670879196223
        },
        {
          metricId: "aa-omniscience",
          weight: 0.12209670879196223
        },
        {
          metricId: "tau3-banking",
          weight: 0.08030235812631839
        },
        {
          metricId: "arc-agi-3",
          weight: 0.030312735948243918
        },
        {
          metricId: "aa-omniscience-accuracy",
          weight: 0.05070608718928385
        },
        {
          metricId: "aa-briefcase",
          weight: 0.08546769615437352
        },
        {
          metricId: "aa-lcr",
          weight: 0.08086590475440969
        },
        {
          metricId: "mmmu-pro",
          weight: 0.052429776335612785
        },
        {
          metricId: "baby-vision",
          weight: 0.052429776335612785
        },
        {
          metricId: "hle",
          weight: 0.14065540852834046
        },
        {
          metricId: "arena-text-multi-turn",
          weight: 0.03027006512595892
        },
        {
          metricId: "agent-arena-praise-vs-complaint",
          weight: 0.03027006512595892
        }
      ]
    },
    {
      id: "arc-hle-roboflow-fallback",
      version: "1.0",
      kind: "composite",
      family: "quality",
      name: "HLE + Roboflow",
      description: "Equal-weight secondary ARC-AGI-3 fallback using HLE and Roboflow Visual Reasoning.",
      fallbackOnly: true,
      components: [
        {
          metricId: "hle",
          weight: 0.6
        },
        {
          metricId: "roboflow-visual-reasoning",
          weight: 0.2
        },
        {
          metricId: "aa-omniscience-accuracy",
          weight: 0.2
        }
      ]
    },
    {
      id: "atlas-qna-fallback-composite",
      version: "1.0",
      kind: "composite",
      family: "quality",
      name: "Atlas-QnA Fallback",
      description: "",
      fallbackOnly: true,
      components: [
        {
          metricId: "aa-omniscience",
          weight: 0.2
        },
        {
          metricId: "aa-lcr",
          weight: 0.5
        },
        {
          metricId: "deepswe-1-1",
          weight: 0.3
        }
      ]
    },
    {
      id: "saas-agentic-composite",
      version: "1.0",
      kind: "composite",
      family: "quality",
      name: "Real SaaS Index - Agentic",
      description: "Prioritizes agentic tool use at high speeds without getting access to web search",
      components: [
        {
          metricId: "aa-omniscience",
          weight: 0.0864168635115155
        },
        {
          metricId: "tau3-banking",
          weight: 0.14840467547556419
        },
        {
          metricId: "terminal-bench-v4",
          weight: 0.2081967920107127
        },
        {
          metricId: "composite-speed-score",
          weight: 0.27875019643552224
        },
        {
          metricId: "aa-briefcase",
          weight: 0.10858878693333963
        },
        {
          metricId: "aa-lcr",
          weight: 0.08322582212183016
        },
        {
          metricId: "aa-omniscience-hallucination-rate",
          weight: 0.0864168635115155
        }
      ]
    },
    {
      id: "saas-conversational-composite",
      version: "1.0",
      kind: "composite",
      family: "quality",
      name: "Real SaaS Index - Conversational",
      description: "Prioritizes speed and informative responses while maintaining a large context and without web search or significant tool calling",
      components: [
        {
          metricId: "time-to-first-answer-token",
          weight: 0.22018234659140157
        },
        {
          metricId: "composite-speed-score",
          weight: 0.0825888738038999
        },
        {
          metricId: "arena-text-multi-turn",
          weight: 0.20647218450974975
        },
        {
          metricId: "aa-omniscience",
          weight: 0.12763735042420896
        },
        {
          metricId: "aa-lcr",
          weight: 0.22148834338318613
        },
        {
          metricId: "agent-arena-praise-vs-complaint",
          weight: 0.06137339055793991
        },
        {
          metricId: "aa-briefcase",
          weight: 0.08025751072961372
        }
      ]
    }
  ],
  publishedIndices: [
    {
      id: "real-frontier-2026-custom-custom",
      version: "2026.1",
      title: "Real Frontier Index",
      lastUpdated: "2026-09-06",
      subtitle: "Balanced frontier capability",
      description: "Overall Weighted Real Intelligence Index",
      rootMetricId: "real-frontier-2026-custom-custom-composite",
      isDefault: true
    },
    {
      id: "real-coding-2026",
      version: "2026.2",
      title: "Real Software Engineering Index",
      lastUpdated: "2026-09-06",
      subtitle: "Engineering work",
      description: "Long-horizon engineering, architecting, and repository comprehension. ",
      rootMetricId: "real-coding-composite"
    },
    {
      id: "real-stem-2026",
      version: "2026.2",
      title: "Real Reasoning & Knowledge Index",
      lastUpdated: "2026-09-06",
      subtitle: "Broad knowledge and reasoning capacity",
      description: "Deep understanding and problem solving. Broad knowledge and reasoning capacity.",
      rootMetricId: "real-stem-composite"
    },
    {
      id: "saas-agentic",
      version: "1.0",
      title: "Real SaaS Index - Agentic",
      lastUpdated: "2026-09-06",
      subtitle: "Action based agentic Saas environments. Prioritizing navigating custom agentic environments with speed",
      description: "Prioritizes agentic tool use at high speeds without getting access to web search",
      rootMetricId: "saas-agentic-composite"
    },
    {
      id: "saas-conversational",
      version: "1.0",
      title: "Real SaaS Index - Conversational",
      lastUpdated: "2026-09-06",
      subtitle: "Quick conversational clarity and accuracy with heavy context",
      description: "Prioritizes speed and informative responses while maintaining a large context and without web search or significant tool calling",
      rootMetricId: "saas-conversational-composite"
    }
  ],
  fallbackRoutes: [
    {
      metricId: "osworld-2",
      fallbackMetricIds: [
        "osworld-verified"
      ]
    },
    {
      metricId: "mmmu-pro",
      fallbackMetricIds: [
        "roboflow-visual-reasoning"
      ]
    },
    {
      metricId: "terminal-bench-v4",
      fallbackMetricIds: [
        "terminal-bench-2-1"
      ]
    },
    {
      metricId: "baby-vision",
      fallbackMetricIds: [
        "roboflow-visual-reasoning"
      ]
    },
    {
      metricId: "tau3-banking",
      fallbackMetricIds: [
        "automationbench",
        "enterprise-ops-gym-aa"
      ]
    },
    {
      metricId: "scicode",
      fallbackMetricIds: [
        "terminal-bench-science"
      ]
    },
    {
      metricId: "arc-agi-3",
      fallbackMetricIds: [
        "arc-agi-2",
        "arc-hle-roboflow-fallback"
      ]
    },
    {
      metricId: "swe-atlas-qna",
      fallbackMetricIds: [
        "atlas-qna-fallback-composite"
      ]
    },
    {
      metricId: "arena-text-multi-turn",
      fallbackMetricIds: [
        "agent-arena",
        "aa-briefcase"
      ]
    },
    {
      metricId: "agent-arena-praise-vs-complaint",
      fallbackMetricIds: [
        "aa-briefcase"
      ]
    }
  ]
};
// src/data/rawMetrics.ts
var rawMetrics = [
  {
    id: "arena-text-multi-turn",
    version: "2026-09-02-scale-3",
    kind: "raw",
    family: "quality",
    name: "Arena Text — Multi-Turn",
    shortName: "Arena Multi-Turn",
    requiresVisionInput: false,
    unit: "Arena rating",
    direction: "higher",
    normalization: {
      lowerAnchor: 1428.888888888889,
      upperAnchor: 1600,
      clamp: true
    },
    source: {
      benchmarkName: "Arena Text — Multi-Turn",
      primarySourceUrl: "https://arena.ai/leaderboard/text/multi-turn",
      citation: "Official benchmark source, September 5, 2026 collection",
      description: "Anonymous human preference votes on multi-turn conversations. Fixed editorial rating anchors approximately 1428.8889–1600 place Grok 4.6's September 5 recorded rating of 1446 at 10 points. Bounds do not move with new results; ratings are not percentages. Agent Arena is a related collaboration fallback, not the same preference experiment."
    }
  },
  {
    id: "agent-arena",
    version: "2026-09-01-scale-2",
    kind: "raw",
    family: "quality",
    name: "Agent Arena",
    shortName: "Agent Arena",
    requiresVisionInput: false,
    unit: "Net improvement (pp)",
    direction: "higher",
    normalization: {
      lowerAnchor: -5,
      upperAnchor: 25,
      clamp: true
    },
    source: {
      benchmarkName: "Agent Arena",
      primarySourceUrl: "https://arena.ai/leaderboard/agent",
      citation: "Official benchmark source, September 5, 2026 collection",
      description: "Overall causal net improvement across five signals from real user sessions. Stored in percentage points relative to the comparison baseline, not task success percent. Fixed editorial -5 to +25 percentage-point anchors map linearly to 0–100 points; zero improvement maps to 16.67 points. Includes Praise vs Complaint, so weighting that separately introduces intentional overlap."
    }
  },
  {
    id: "agent-arena-praise-vs-complaint",
    version: "2026-09-01-scale-2",
    kind: "raw",
    family: "quality",
    name: "Agent Arena — Praise vs Complaint",
    shortName: "Praise vs Complaint",
    requiresVisionInput: false,
    unit: "Net improvement (pp)",
    direction: "higher",
    normalization: {
      lowerAnchor: -5,
      upperAnchor: 35,
      clamp: true
    },
    source: {
      benchmarkName: "Agent Arena — Praise vs Complaint",
      primarySourceUrl: "https://arena.ai/blog/agent-arena-methodology",
      citation: "Official benchmark source, September 5, 2026 collection",
      description: "Separately weightable causal treatment effect for tasks where explicit praise outnumbers complaints. This is improvement relative to a baseline, not the percentage of users who praise a model. Fixed editorial -5 to +35 percentage-point anchors map linearly to 0–100 points; zero improvement maps to 12.5 points."
    }
  },
  {
    id: "osworld-2",
    version: "2.0-2026.08.08-full",
    kind: "raw",
    family: "quality",
    name: "OSWorld 2.0 (August, full completion)",
    shortName: "OSWorld 2.0",
    requiresVisionInput: true,
    unit: "Completed tasks (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "OSWorld 2.0 (August, full completion)",
      primarySourceUrl: "https://osworld-v2.xlang.ai/",
      citation: "Official benchmark source, September 5, 2026 collection",
      description: "Full-task binary/strict completion on the authors' August 2026 full task release. Desktop and browser workflows with computer tools, including image input. Preserve harness differences in observations; never mix partial rewards, offline-only results, or June task files into this metric."
    }
  },
  {
    id: "osworld-verified",
    version: "verified-2025.07.28",
    kind: "raw",
    family: "quality",
    name: "OSWorld Verified",
    shortName: "OSWorld Verified",
    requiresVisionInput: true,
    unit: "Task success (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "OSWorld Verified",
      primarySourceUrl: "https://osworld-v1.xlang.ai/",
      citation: "Official benchmark source, September 5, 2026 collection",
      description: "Verified real desktop and browser task success. Run-specific step limits, tools and evaluated task denominators remain in provenance. A shorter-workflow fallback for OSWorld 2.0."
    }
  },
  {
    id: "roboflow-visual-reasoning",
    version: "high-2026-09-05",
    kind: "raw",
    family: "vision",
    name: "Roboflow Visual Reasoning (high)",
    shortName: "Roboflow Vision",
    requiresVisionInput: true,
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: { lowerAnchor: 0, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "Roboflow Visual Reasoning",
      primarySourceUrl: "https://playground.roboflow.com/evals/visual-reasoning",
      citation: "Roboflow Vision Evals, September 5, 2026 high-tier snapshot",
      description: "Reasoning from images through spatial relationships, comparisons, arithmetic and multi-step inference. Uses ground-truth accuracy graded by Gemini 3.5 Flash, not the strict-match score. High-tier settings may differ from catalogued max/xhigh efforts; those observations are marked as supporting evidence."
    }
  },
  {
    id: "terminal-bench-2-1",
    version: "2.1-scale-2",
    kind: "raw",
    family: "quality",
    name: "Terminal-Bench 2.1",
    shortName: "TermBench 2.1",
    requiresVisionInput: false,
    unit: "Score (%)",
    direction: "higher",
    normalization: { lowerAnchor: 50, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "Terminal-Bench 2.1",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/terminalbench-v2-1",
      citation: "September 5, 2026 fallback research snapshot",
      description: "AA Terminus 2 evaluation of Terminal-Bench 2.1. Older, easier tasks than v4; converted to the v4 scale only through a frozen calibration."
    }
  },
  {
    id: "mmmu-pro",
    version: "aa-10-option-2026-09-05-scale-2",
    kind: "raw",
    family: "vision",
    name: "MMMU-Pro (AA 10-option)",
    shortName: "MMMU-Pro",
    requiresVisionInput: true,
    unit: "Score (%)",
    direction: "higher",
    normalization: { lowerAnchor: 50, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "MMMU-Pro (AA 10-option)",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/mmmu-pro",
      citation: "September 5, 2026 fallback research snapshot",
      description: "AA 10-option visual academic reasoning evaluation. Related to Baby Vision but more knowledge-dependent; native image input is required."
    }
  },
  {
    id: "arc-agi-2",
    version: "2.0",
    kind: "raw",
    family: "quality",
    name: "ARC-AGI-2 (verified semi-private)",
    shortName: "ARC-AGI-2",
    requiresVisionInput: false,
    unit: "Score (%)",
    direction: "higher",
    normalization: { lowerAnchor: 0, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "ARC-AGI-2 (verified semi-private)",
      primarySourceUrl: "https://arcprize.org/arc-agi/2",
      citation: "September 5, 2026 fallback research snapshot",
      description: "Verified semi-private static grid reasoning. This older suite does not measure all of ARC-AGI-3's interactive exploration abilities."
    }
  },
  {
    id: "automationbench",
    version: "1.0.6",
    kind: "raw",
    family: "quality",
    name: "AutomationBench 1.0.6",
    shortName: "AutomationBench",
    requiresVisionInput: false,
    unit: "Task success (%)",
    direction: "higher",
    normalization: { lowerAnchor: 0, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "AutomationBench 1.0.6",
      primarySourceUrl: "https://zapier.com/benchmarks",
      citation: "Zapier AutomationBench 1.0.6 (2026)",
      description: "Strict task completion on held-out business workflows: every final-state assertion must pass. Uses Zapier leaderboard runs, not AA objective-completion scores."
    }
  },
  {
    id: "enterprise-ops-gym-aa",
    version: "2026-09-05-scale-2",
    kind: "raw",
    family: "quality",
    name: "EnterpriseOps-Gym-AA",
    shortName: "EnterpriseOps",
    requiresVisionInput: false,
    unit: "Task success (%)",
    direction: "higher",
    normalization: { lowerAnchor: 20, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "EnterpriseOps-Gym-AA",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/enterprise-ops-gym-aa",
      citation: "ServiceNow EnterpriseOps-Gym; independent Artificial Analysis evaluation (2026)",
      description: "Strict final-state success across eight enterprise domains, using AA Stirrup in oracle tool mode with three repeats. Relevant tools are supplied; this is not a tool-discovery evaluation."
    }
  },
  {
    id: "terminal-bench-science",
    version: "0.1",
    kind: "raw",
    family: "quality",
    name: "Terminal-Bench-Science 0.1",
    shortName: "TB Science",
    requiresVisionInput: false,
    unit: "Task success (%)",
    direction: "higher",
    normalization: { lowerAnchor: 0, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "Terminal-Bench-Science 0.1",
      primarySourceUrl: "https://www.terminal-bench-science.ai/",
      citation: "Stanford / Laude Institute Terminal-Bench-Science 0.1 (2026)",
      description: "70 scientific research workflow tasks, with executable evaluation and three trials per task. Official leaderboard observations retain each model’s agent and reasoning effort."
    }
  },
  {
    id: "aa-lcr",
    requiresVisionInput: false,
    version: "1.1-scale-2",
    kind: "raw",
    family: "quality",
    name: "AA-LCR v1.1",
    shortName: "AA-LCR",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: { lowerAnchor: 50, upperAnchor: 100, clamp: true },
    source: {
      benchmarkName: "Artificial Analysis Long Context Reasoning v1.1",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/artificial-analysis-long-context-reasoning",
      citation: "Artificial Analysis AA-LCR v1.1 (2026)",
      description: "100 human-written questions requiring reasoning across document sets of 10k–100k tokens. Independent AA evaluation reports pass@1 accuracy averaged over three runs."
    }
  },
  {
    id: "aa-briefcase",
    requiresVisionInput: false,
    version: "2026-09-05-scale-3",
    kind: "raw",
    family: "quality",
    name: "AA-Briefcase",
    shortName: "AA-Briefcase",
    unit: "Elo",
    direction: "higher",
    normalization: { lowerAnchor: 500, upperAnchor: 2000, clamp: true },
    source: {
      benchmarkName: "AA-Briefcase",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/aa-briefcase",
      citation: "Artificial Analysis AA-Briefcase (September 2026 snapshot)",
      description: "91 private agentic knowledge-work tasks across four business scenarios, evaluated with Stirrup. Combined Elo incorporates rubric correctness, analytical quality, and presentation. Index normalization uses fixed editorial anchors of 500 to 2000 Elo, not a benchmark percentage or official upper bound."
    }
  },
  {
    id: "terminal-bench-v4",
    requiresVisionInput: false,
    version: "4.0",
    kind: "raw",
    family: "quality",
    name: "Terminal-Bench v4",
    shortName: "TermBench v4",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "Terminal-Bench v4",
      primarySourceUrl: "https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/latest?leaderboard=4-0-0&tab=leaderboard",
      citation: "Harbor Framework / Laude Institute Terminal-Bench 4.0 (2026)",
      description: "66 difficult terminal tasks evaluated in isolated Harbor environments, using the official versioned dataset and leaderboard accuracy."
    }
  },
  {
    id: "deepswe-1-1",
    requiresVisionInput: false,
    version: "1.1-scale-2",
    kind: "raw",
    family: "quality",
    name: "DeepSWE 1.1",
    shortName: "DeepSWE",
    unit: "Resolved (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 30,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "DeepSWE 1.1",
      primarySourceUrl: "https://deepswe.datacurve.ai/",
      citation: "Datacurve DeepSWE Benchmark (2026)",
      description: "Deep software engineering benchmark requiring multi-file architectural refactoring, complex bug reproduction, and multi-package patch synthesis in sandboxed repositories."
    }
  },
  {
    id: "swe-atlas-qna",
    requiresVisionInput: false,
    version: "1.0",
    kind: "raw",
    family: "quality",
    name: "SWE Atlas-QnA",
    shortName: "Atlas-QnA",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "SWE Atlas-QnA",
      primarySourceUrl: "https://labs.scale.com/leaderboard/sweatlas-qna",
      citation: "Scale AI SWE Atlas Benchmark (2026)",
      description: "Whole-repository architectural comprehension, deep call-graph tracing, system design rationale, and cross-file dependency QA."
    }
  },
  {
    id: "arc-agi-3",
    requiresVisionInput: false,
    version: "3.0",
    kind: "raw",
    family: "quality",
    name: "ARC-AGI-3",
    shortName: "ARC-AGI-3",
    unit: "Score (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "ARC-AGI-3",
      primarySourceUrl: "https://htv3.arc-prize.com/leaderboard",
      citation: "Abstraction and Reasoning Corpus v3 (Chollet & ARC Prize Foundation, 2025-2026)",
      description: "Interaction with unfamiliar environments, scored by level completion and action efficiency relative to humans."
    }
  },
  {
    id: "hle",
    requiresVisionInput: false,
    version: "1.0",
    kind: "raw",
    family: "quality",
    name: "Humanity's Last Exam (HLE)",
    shortName: "HLE",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "Humanity's Last Exam",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/humanitys-last-exam",
      citation: "Center for AI Safety / Scale AI; independent scores by Artificial Analysis (2025-2026)",
      description: "Ultra-challenging multidisciplinary academic questions designed to test frontier knowledge at the limits of domain expertise."
    }
  },
  {
    id: "baby-vision",
    requiresVisionInput: true,
    version: "1.0",
    kind: "raw",
    family: "vision",
    name: "Baby Vision",
    shortName: "Baby Vision",
    unit: "Score (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "Baby Vision",
      primarySourceUrl: "https://arxiv.org/abs/2601.06521",
      citation: "BabyVision: Visual Reasoning Beyond Language (2026)",
      description: "Fine-grained spatial grounding, visual object occlusion, physical 3D relationship tracking, and complex diagram parsing."
    }
  },
  {
    id: "aa-omniscience",
    requiresVisionInput: false,
    version: "2026.1",
    kind: "raw",
    family: "knowledge",
    name: "Artificial Analysis Omniscience",
    shortName: "AA Omniscience",
    unit: "Index (-100 to 100)",
    direction: "higher",
    normalization: {
      lowerAnchor: -100,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "AA-Omniscience Index",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/omniscience",
      citation: "Artificial Analysis AA-Omniscience (2026)",
      description: "Knowledge reliability index ranging from -100 to 100; correct answers are rewarded, hallucinations are penalized, and refusals are not penalized."
    }
  },
  {
    id: "tau3-banking",
    requiresVisionInput: false,
    version: "3.0",
    kind: "raw",
    family: "quality",
    name: "\uD835\uDF0F³-Banking Benchmark",
    shortName: "\uD835\uDF0F³ Banking",
    unit: "Pass@1 (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "\uD835\uDF0F³-Banking",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/tau3-banking",
      citation: "Sierra Research τ-Bench / τ-Knowledge; independent scores by Artificial Analysis (2026)",
      description: "97 multi-turn banking customer-service tasks over a large knowledge base, evaluated through policy-following, knowledge retrieval, and state-changing tool-use success."
    }
  },
  {
    id: "scicode",
    requiresVisionInput: false,
    version: "1.0-scale-2",
    kind: "raw",
    family: "quality",
    name: "SciCode",
    shortName: "SciCode",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 20,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "SciCode",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/scicode",
      citation: "SciCode Benchmark; independent scores by Artificial Analysis (2024-2026)",
      description: "Scientist-curated scientific research coding problems requiring domain knowledge, reasoning, code synthesis, and executable validation across the natural sciences."
    }
  },
  {
    id: "aa-omniscience-accuracy",
    requiresVisionInput: false,
    version: "2026.1",
    kind: "raw",
    family: "knowledge",
    name: "AA-Omniscience Accuracy",
    shortName: "AA Accuracy",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "AA-Omniscience Accuracy",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/omniscience",
      citation: "Artificial Analysis AA-Omniscience (2026)",
      description: "Proportion of correctly answered questions out of all questions, regardless of whether the model chooses to answer."
    }
  },
  {
    id: "aa-omniscience-hallucination-rate",
    requiresVisionInput: false,
    version: "2026.1",
    kind: "raw",
    family: "knowledge",
    name: "AA-Omniscience Hallucination Rate",
    shortName: "AA Hallucination",
    unit: "Rate (%)",
    direction: "lower",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "AA-Omniscience Hallucination Rate",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/omniscience",
      citation: "Artificial Analysis AA-Omniscience (2026)",
      description: "Proportion of incorrect answers among non-correct responses when the model should have refused or admitted it did not know the answer."
    }
  },
  {
    id: "critpt",
    requiresVisionInput: false,
    version: "1.0",
    kind: "raw",
    family: "quality",
    name: "CritPt",
    shortName: "CritPt",
    unit: "Accuracy (%)",
    direction: "higher",
    normalization: {
      lowerAnchor: 0,
      upperAnchor: 100,
      clamp: true
    },
    source: {
      benchmarkName: "CritPt",
      primarySourceUrl: "https://artificialanalysis.ai/evaluations/critpt",
      citation: "CritPt Benchmark; independent scores by Artificial Analysis (2025-2026)",
      description: "Research-level physics reasoning benchmark built from unpublished challenges across modern physics domains and evaluated with challenge-level accuracy."
    }
  },
  {
    id: "output-speed",
    requiresVisionInput: false,
    version: "1.2",
    kind: "raw",
    family: "speed",
    name: "Median Output Speed",
    shortName: "Speed",
    unit: "tokens/s",
    direction: "higher",
    normalization: {
      lowerAnchor: 25,
      upperAnchor: 1000,
      clamp: true
    },
    source: {
      benchmarkName: "Output Throughput",
      primarySourceUrl: "https://artificialanalysis.ai/methodology/performance-benchmarking",
      citation: "Artificial Analysis Performance Benchmarking (2026)",
      description: "Median generation speed in tokens per second under standard API evaluation workloads."
    }
  },
  {
    id: "time-per-task",
    requiresVisionInput: false,
    version: "1.1",
    kind: "raw",
    family: "latency",
    name: "Time per Intelligence Index Task",
    shortName: "Task Time",
    unit: "seconds",
    direction: "lower",
    normalization: {
      scale: "log",
      lowerAnchor: 20,
      upperAnchor: 1020,
      clamp: true
    },
    source: {
      benchmarkName: "Artificial Analysis Intelligence Index Task Time",
      primarySourceUrl: "https://artificialanalysis.ai/methodology/performance-benchmarking",
      citation: "Artificial Analysis Performance Benchmarking (2026)",
      description: "Weighted average decode time in seconds per Artificial Analysis Intelligence Index task, excluding time to first token and overhead."
    }
  },
  {
    id: "time-to-first-answer-token",
    requiresVisionInput: false,
    version: "1.1",
    kind: "raw",
    family: "latency",
    name: "Time to First Answer Token",
    shortName: "TTFAT",
    unit: "seconds",
    direction: "lower",
    normalization: {
      scale: "log",
      lowerAnchor: 1,
      upperAnchor: 350,
      clamp: true
    },
    source: {
      benchmarkName: "Time to First Answer Token",
      primarySourceUrl: "https://artificialanalysis.ai/methodology/performance-benchmarking",
      citation: "Artificial Analysis Performance Benchmarking (2026)",
      description: "Seconds from API request submission until the first answer token is received; for reasoning models this includes thinking time."
    }
  },
  {
    id: "cost-per-task",
    requiresVisionInput: false,
    version: "1.1",
    kind: "raw",
    family: "cost",
    name: "Cost per Task",
    shortName: "Cost/Task",
    unit: "USD ($)",
    direction: "lower",
    normalization: {
      scale: "log",
      lowerAnchor: 0.0283533923674851,
      upperAnchor: 6.336425908810413,
      clamp: true
    },
    source: {
      benchmarkName: "Cost per Intelligence Task",
      primarySourceUrl: "https://artificialanalysis.ai/methodology",
      citation: "Artificial Analysis Intelligence Index Task Pricing (2026)",
      description: "Weighted average monetary cost in USD required to execute one Artificial Analysis Intelligence Index task."
    }
  },
  {
    id: "blended-token-price",
    requiresVisionInput: false,
    version: "2.0-cache-7-2-1",
    kind: "raw",
    family: "cost",
    name: "Blended Price per 1M Tokens",
    shortName: "Price/1M",
    unit: "USD ($)",
    direction: "lower",
    normalization: {
      scale: "log",
      lowerAnchor: 0.28004983977981524,
      upperAnchor: 32.137136757786074,
      clamp: true
    },
    source: {
      benchmarkName: "Blended API Pricing",
      primarySourceUrl: "https://artificialanalysis.ai/methodology",
      citation: "Artificial Analysis 7:2:1 cache-hit/input/output pricing methodology (2026-09-05)",
      description: "70% cache-hit input, 20% uncached input and 10% output per million total tokens. Uses a coherent provider endpoint and pricing tier; cache creation and storage charges are outside this token-price blend."
    }
  }
];

// src/engine/dag.ts
function validateMetricDAG(rootMetricId, metricMap) {
  const visited = new Set;
  const recursionStack = new Set;
  function dfs(metricId, path) {
    if (recursionStack.has(metricId)) {
      throw new Error(`Cycle detected in metric definitions: ${[...path, metricId].join(" -> ")}`);
    }
    if (visited.has(metricId)) {
      return;
    }
    const metric = metricMap.get(metricId);
    if (!metric) {
      throw new Error(`Referenced metric '${metricId}' does not exist in metric definitions.`);
    }
    visited.add(metricId);
    recursionStack.add(metricId);
    if (metric.kind === "composite") {
      let weightSum = 0;
      for (const comp of metric.components) {
        weightSum += comp.weight;
        dfs(comp.metricId, [...path, metricId]);
      }
      if (Math.abs(weightSum - 1) > 0.005) {
        throw new Error(`Composite metric '${metric.id}' components must sum to 1.0 (found ${weightSum.toFixed(4)})`);
      }
    }
    recursionStack.delete(metricId);
  }
  dfs(rootMetricId, []);
}
function resolveEffectiveLeafWeights(rootMetricId, metricMap) {
  validateMetricDAG(rootMetricId, metricMap);
  const leafWeights = new Map;
  function traverse(metricId, currentWeight) {
    const metric = metricMap.get(metricId);
    if (!metric) {
      throw new Error(`Referenced metric '${metricId}' does not exist in metric definitions.`);
    }
    if (metric.kind === "raw") {
      const existing = leafWeights.get(metric.id) ?? 0;
      leafWeights.set(metric.id, existing + currentWeight);
    } else {
      for (const comp of metric.components) {
        traverse(comp.metricId, currentWeight * comp.weight);
      }
    }
  }
  traverse(rootMetricId, 1);
  return Array.from(leafWeights.entries()).map(([rawMetricId, effectiveWeight]) => ({
    rawMetricId,
    effectiveWeight
  }));
}

// src/engine/normalizer.ts
function normalizeRawValue(raw, definition) {
  const { lowerAnchor, upperAnchor } = definition.normalization;
  if (upperAnchor === lowerAnchor) {
    return 50;
  }
  let normalized;
  if (definition.normalization.scale === "log") {
    const bounded = Math.max(lowerAnchor, Math.min(upperAnchor, raw));
    const score = 100 * Math.log(upperAnchor / bounded) / Math.log(upperAnchor / lowerAnchor);
    return definition.direction === "lower" ? score : 100 - score;
  }
  if (definition.direction === "higher") {
    normalized = 100 * ((raw - lowerAnchor) / (upperAnchor - lowerAnchor));
  } else {
    normalized = 100 * ((upperAnchor - raw) / (upperAnchor - lowerAnchor));
  }
  return Math.max(0, Math.min(100, normalized));
}

// src/engine/fallbackSources.ts
function requiresVision(metric, metrics) {
  return resolveEffectiveLeafWeights(metric.id, metrics).some((leaf) => {
    const raw = metrics.get(leaf.rawMetricId);
    return leaf.effectiveWeight > 0 && raw?.kind === "raw" && raw.requiresVisionInput;
  });
}
function readFallbackSource(model, metric, metrics, observations, crossEffort) {
  const components = [];
  for (const leaf of resolveEffectiveLeafWeights(metric.id, metrics)) {
    if (leaf.effectiveWeight <= 0)
      continue;
    const raw = metrics.get(leaf.rawMetricId);
    const observation = observations.get(`${model.id}:${leaf.rawMetricId}`);
    if (raw?.kind !== "raw")
      return null;
    if (raw.requiresVisionInput && model.visionInput === "unsupported") {
      if (observation)
        return null;
      components.push({ metric: raw, state: "unsupported", weight: leaf.effectiveWeight, normalizedValue: 0 });
      continue;
    }
    if (!observation) {
      const top = crossEffort && ["quality", "knowledge", "vision"].includes(raw.family) ? observations.get(`${crossEffort.topModelId}:${raw.id}`) : undefined;
      if (!top || !crossEffort)
        return null;
      components.push({
        metric: raw,
        state: "cross-effort",
        observation: top,
        weight: leaf.effectiveWeight,
        normalizedValue: Math.max(0, Math.min(100, normalizeRawValue(top.value, raw) * crossEffort.factor))
      });
      continue;
    }
    components.push({
      metric: raw,
      state: "measured",
      observation,
      weight: leaf.effectiveWeight,
      normalizedValue: normalizeRawValue(observation.value, raw)
    });
  }
  return {
    score: components.reduce((sum, part) => sum + part.weight * part.normalizedValue, 0),
    perfectVisionScore: components.reduce((sum, part) => sum + part.weight * (part.state === "unsupported" ? 100 : part.normalizedValue), 0),
    components
  };
}

// src/engine/catalog.ts
var sharedComparisonIds = ["composite-speed-score", "composite-affordability-score"];
function record(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a catalog object.");
  return value;
}
function text(value, label, allowEmpty = false) {
  if (typeof value !== "string" || !allowEmpty && !value.trim())
    throw new Error(`${label} is required.`);
  return value;
}
function id(value) {
  const result = text(value, "ID");
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(result))
    throw new Error("IDs must use lowercase letters, numbers, hyphens or underscores.");
  return result;
}
function isoDate(value, label) {
  const result = text(value, label);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new Error(`${label} must use YYYY-MM-DD.`);
  }
  return result;
}
function createCatalogMetricMap(rawMetrics2, catalog) {
  const routes = new Map(catalog.fallbackRoutes.map((route) => [route.metricId, route.fallbackMetricIds]));
  return new Map([
    ...rawMetrics2.map((metric) => [metric.id, { ...metric, fallbackMetricIds: routes.get(metric.id) ?? [] }]),
    ...catalog.compositeMetrics.map((metric) => [metric.id, metric])
  ]);
}
function parseIndexCatalog(input, rawMetrics2) {
  const data = record(input);
  if (!Array.isArray(data.compositeMetrics) || !Array.isArray(data.publishedIndices) || !Array.isArray(data.fallbackRoutes)) {
    throw new Error("Catalog requires compositeMetrics, publishedIndices and fallbackRoutes arrays.");
  }
  const families = ["quality", "speed", "latency", "cost", "vision", "knowledge"];
  const compositeMetrics = data.compositeMetrics.map((value) => {
    const metric = record(value);
    if (metric.kind !== "composite" || !families.includes(metric.family))
      throw new Error("Invalid composite metric type.");
    if (!Array.isArray(metric.components) || metric.components.length === 0)
      throw new Error("Add at least one component.");
    if (metric.fallbackOnly !== undefined && typeof metric.fallbackOnly !== "boolean")
      throw new Error("Invalid fallback-only flag.");
    const components = metric.components.map((value2) => {
      const part = record(value2);
      if (typeof part.weight !== "number" || !Number.isFinite(part.weight) || part.weight < 0)
        throw new Error("Weights must be finite, non-negative numbers.");
      return { metricId: id(part.metricId), weight: part.weight };
    });
    if (Math.abs(components.reduce((sum, part) => sum + part.weight, 0) - 1) > 0.00000001)
      throw new Error("Component weights must sum to 100%.");
    return {
      id: id(metric.id),
      version: text(metric.version, "Formula version"),
      kind: "composite",
      family: metric.family,
      name: text(metric.name, "Formula name"),
      description: text(metric.description, "Description", true),
      ...metric.fallbackOnly ? { fallbackOnly: true } : {},
      components
    };
  });
  const publishedIndices = data.publishedIndices.map((value) => {
    const index = record(value);
    if (index.isDefault !== undefined && typeof index.isDefault !== "boolean")
      throw new Error("Invalid default index flag.");
    return {
      id: id(index.id),
      version: text(index.version, "Index version"),
      title: text(index.title, "Index title"),
      lastUpdated: isoDate(index.lastUpdated, "Index last updated date"),
      subtitle: text(index.subtitle, "Subtitle", true),
      description: text(index.description, "Description", true),
      rootMetricId: id(index.rootMetricId),
      ...index.isDefault ? { isDefault: true } : {}
    };
  });
  const fallbackRoutes = data.fallbackRoutes.map((value) => {
    const route = record(value);
    if (!Array.isArray(route.fallbackMetricIds))
      throw new Error("Fallbacks must be an ordered list.");
    const fallbackMetricIds = route.fallbackMetricIds.map(id);
    if (new Set(fallbackMetricIds).size !== fallbackMetricIds.length)
      throw new Error("Each fallback may appear only once in a route.");
    return { metricId: id(route.metricId), fallbackMetricIds };
  });
  if (new Set(fallbackRoutes.map((route) => route.metricId)).size !== fallbackRoutes.length)
    throw new Error("Each benchmark has one fallback route.");
  const ids = [...rawMetrics2, ...compositeMetrics].map((metric) => metric.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Metric IDs must be unique.");
  if (new Set(publishedIndices.map((index) => index.id)).size !== publishedIndices.length)
    throw new Error("Index IDs must be unique.");
  if (publishedIndices.filter((index) => index.isDefault).length !== (publishedIndices.length ? 1 : 0)) {
    throw new Error("Choose exactly one default index.");
  }
  if (data.manualCalibrations !== undefined && !Array.isArray(data.manualCalibrations))
    throw new Error("Manual calibrations must be an array.");
  const manualCalibrations = (data.manualCalibrations ?? []).map((value) => {
    const entry = record(value);
    if (typeof entry.factor !== "number" || !Number.isFinite(entry.factor) || entry.factor < 0)
      throw new Error("Manual calibration factors must be finite, non-negative numbers.");
    const targetMetricId = id(entry.targetMetricId);
    const sourceMetricId = id(entry.sourceMetricId);
    if (!fallbackRoutes.some((route) => route.metricId === targetMetricId && route.fallbackMetricIds.includes(sourceMetricId))) {
      throw new Error("Manual calibration must reference a registered fallback route.");
    }
    return {
      targetMetricId,
      sourceMetricId,
      factor: entry.factor,
      targetSignature: text(entry.targetSignature, "Target signature"),
      sourceSignature: text(entry.sourceSignature, "Source signature"),
      rationale: text(entry.rationale, "Manual calibration rationale")
    };
  });
  if (new Set(manualCalibrations.map((entry) => `${entry.targetMetricId}:${entry.sourceMetricId}`)).size !== manualCalibrations.length) {
    throw new Error("Each fallback route may have one manual calibration.");
  }
  const catalog = { compositeMetrics, publishedIndices, fallbackRoutes, ...manualCalibrations.length ? { manualCalibrations } : {} };
  const map = createCatalogMetricMap(rawMetrics2, catalog);
  for (const metric of compositeMetrics)
    validateMetricDAG(metric.id, map);
  for (const index of publishedIndices) {
    const root = map.get(index.rootMetricId);
    if (root?.kind === "composite" && root.fallbackOnly)
      throw new Error("Fallback-only formulas cannot be published as indexes.");
    if (root?.kind !== "composite")
      throw new Error(`Index "${index.title}" needs an existing composite formula.`);
  }
  for (const sharedId of sharedComparisonIds) {
    const shared = map.get(sharedId);
    if (shared?.kind === "composite" && shared.fallbackOnly)
      throw new Error("Shared comparison formulas cannot be fallback-only.");
    if (shared?.kind !== "composite")
      throw new Error("Speed and Affordability formulas are required by the comparison views.");
  }
  for (const route of fallbackRoutes) {
    const target = map.get(route.metricId);
    if (target?.kind !== "raw")
      throw new Error("Fallback targets must be raw benchmarks.");
    for (const sourceId of route.fallbackMetricIds) {
      const source = map.get(sourceId);
      if (!source)
        throw new Error(`Unknown fallback '${sourceId}'.`);
      if (resolveEffectiveLeafWeights(sourceId, map).some((leaf) => leaf.effectiveWeight > 0 && leaf.rawMetricId === target.id)) {
        throw new Error(`Fallback '${sourceId}' depends on its own target '${target.id}'.`);
      }
      if (target.requiresVisionInput && !requiresVision(source, map))
        throw new Error("Vision benchmarks require a fallback with vision input.");
    }
  }
  return catalog;
}

// src/data/metrics.ts
var catalog = indexCatalog_default;
var compositeMetrics = catalog.compositeMetrics;
var publicCompositeMetrics = compositeMetrics.filter((metric) => !metric.fallbackOnly);
var rawMetrics2 = [...createCatalogMetricMap(rawMetrics, catalog).values()].filter((metric) => metric.kind === "raw");
function buildMetricMap(currentCatalog = catalog) {
  return createCatalogMetricMap(rawMetrics, currentCatalog);
}
// src/data/publishedIndices.ts
var publishedIndices = indexCatalog_default.publishedIndices;
// src/data/calibrations.json
var calibrations_default = [
  {
    id: "paired-mean-manual-v3:arena-text-multi-turn:agent-arena",
    targetMetricId: "arena-text-multi-turn",
    sourceMetricId: "agent-arena",
    targetSignature: '["arena-text-multi-turn","2026-09-02-scale-3","higher",false,"linear",1428.888888888889,1600]',
    sourceSignature: '["agent-arena","2026-09-01-scale-2","higher",false,"linear",-5,25]',
    targetReferenceCount: 12,
    sourceReferenceCount: 12,
    pairedCount: 10,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 10 overlapping models.",
    scale: {
      sourceAnchor: 29.570000000000004,
      targetAnchor: 29.636363636363626
    }
  },
  {
    id: "paired-mean-manual-v3:arena-text-multi-turn:aa-briefcase",
    targetMetricId: "arena-text-multi-turn",
    sourceMetricId: "aa-briefcase",
    targetSignature: '["arena-text-multi-turn","2026-09-02-scale-3","higher",false,"linear",1428.888888888889,1600]',
    sourceSignature: '["aa-briefcase","2026-09-05-scale-3","higher",false,"linear",500,2000]',
    targetReferenceCount: 12,
    sourceReferenceCount: 33,
    pairedCount: 11,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 11 overlapping models.",
    scale: {
      sourceAnchor: 57.24006060606061,
      targetAnchor: 28.75442739079102
    }
  },
  {
    id: "paired-mean-manual-v3:agent-arena-praise-vs-complaint:aa-briefcase",
    targetMetricId: "agent-arena-praise-vs-complaint",
    sourceMetricId: "aa-briefcase",
    targetSignature: '["agent-arena-praise-vs-complaint","2026-09-01-scale-2","higher",false,"linear",-5,35]',
    sourceSignature: '["aa-briefcase","2026-09-05-scale-3","higher",false,"linear",500,2000]',
    targetReferenceCount: 12,
    sourceReferenceCount: 33,
    pairedCount: 9,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 9 overlapping models.",
    scale: {
      sourceAnchor: 53.619481481481486,
      targetAnchor: 29.769444444444446
    }
  },
  {
    id: "paired-mean-manual-v3:osworld-2:osworld-verified",
    targetMetricId: "osworld-2",
    sourceMetricId: "osworld-verified",
    targetSignature: '["osworld-2","2.0-2026.08.08-full","higher",true,"linear",0,100]',
    sourceSignature: '["osworld-verified","verified-2025.07.28","higher",true,"linear",0,100]',
    targetReferenceCount: 5,
    sourceReferenceCount: 6,
    pairedCount: 2,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 2 overlapping models.",
    scale: {
      sourceAnchor: 83.195,
      targetAnchor: 33.47
    }
  },
  {
    id: "paired-mean-manual-v3:mmmu-pro:roboflow-visual-reasoning",
    targetMetricId: "mmmu-pro",
    sourceMetricId: "roboflow-visual-reasoning",
    targetSignature: '["mmmu-pro","aa-10-option-2026-09-05-scale-2","higher",true,"linear",50,100]',
    sourceSignature: '["roboflow-visual-reasoning","high-2026-09-05","higher",true,"linear",0,100]',
    targetReferenceCount: 28,
    sourceReferenceCount: 14,
    pairedCount: 10,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 10 overlapping models.",
    scale: {
      sourceAnchor: 74.78,
      targetAnchor: 64.28993063583816
    }
  },
  {
    id: "paired-mean-manual-v3:terminal-bench-v4:terminal-bench-2-1",
    targetMetricId: "terminal-bench-v4",
    sourceMetricId: "terminal-bench-2-1",
    targetSignature: '["terminal-bench-v4","4.0","higher",false,"linear",0,100]',
    sourceSignature: '["terminal-bench-2-1","2.1-scale-2","higher",false,"linear",50,100]',
    targetReferenceCount: 8,
    sourceReferenceCount: 39,
    pairedCount: 8,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 8 overlapping models.",
    scale: {
      sourceAnchor: 74.44135767790262,
      targetAnchor: 37.9575
    }
  },
  {
    id: "paired-mean-manual-v3:swe-atlas-qna:atlas-qna-fallback-composite",
    targetMetricId: "swe-atlas-qna",
    sourceMetricId: "atlas-qna-fallback-composite",
    targetSignature: '["swe-atlas-qna","1.0","higher",false,"linear",0,100]',
    sourceSignature: '["atlas-qna-fallback-composite","1.0",[[0.2,"[\\"aa-omniscience\\",\\"2026.1\\",\\"higher\\",false,\\"linear\\",-100,100]"],[0.5,"[\\"aa-lcr\\",\\"1.1-scale-2\\",\\"higher\\",false,\\"linear\\",50,100]"],[0.3,"[\\"deepswe-1-1\\",\\"1.1-scale-2\\",\\"higher\\",false,\\"linear\\",30,100]"]]]',
    targetReferenceCount: 8,
    sourceReferenceCount: 31,
    pairedCount: 7,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 7 overlapping models.",
    scale: {
      sourceAnchor: 59.755018219128154,
      targetAnchor: 36.90114285714286
    }
  },
  {
    id: "paired-mean-manual-v3:arc-agi-3:arc-agi-2",
    targetMetricId: "arc-agi-3",
    sourceMetricId: "arc-agi-2",
    targetSignature: '["arc-agi-3","3.0","higher",false,"linear",0,100]',
    sourceSignature: '["arc-agi-2","2.0","higher",false,"linear",0,100]',
    targetReferenceCount: 11,
    sourceReferenceCount: 20,
    pairedCount: 6,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 6 overlapping models.",
    scale: {
      sourceAnchor: 80.01666666666667,
      targetAnchor: 12.238800350101046
    }
  },
  {
    id: "paired-mean-manual-v3:arc-agi-3:arc-hle-roboflow-fallback",
    targetMetricId: "arc-agi-3",
    sourceMetricId: "arc-hle-roboflow-fallback",
    targetSignature: '["arc-agi-3","3.0","higher",false,"linear",0,100]',
    sourceSignature: '["arc-hle-roboflow-fallback","1.0",[[0.6,"[\\"hle\\",\\"1.0\\",\\"higher\\",false,\\"linear\\",0,100]"],[0.2,"[\\"roboflow-visual-reasoning\\",\\"high-2026-09-05\\",\\"higher\\",true,\\"linear\\",0,100]"],[0.2,"[\\"aa-omniscience-accuracy\\",\\"2026.1\\",\\"higher\\",false,\\"linear\\",0,100]"]]]',
    targetReferenceCount: 19,
    sourceReferenceCount: 14,
    pairedCount: 5,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 5 overlapping models.",
    scale: {
      sourceAnchor: 53.43085259932036,
      targetAnchor: 14.382560420121257
    }
  },
  {
    id: "paired-mean-manual-v3:baby-vision:roboflow-visual-reasoning",
    targetMetricId: "baby-vision",
    sourceMetricId: "roboflow-visual-reasoning",
    targetSignature: '["baby-vision","1.0","higher",true,"linear",0,100]',
    sourceSignature: '["roboflow-visual-reasoning","high-2026-09-05","higher",true,"linear",0,100]',
    targetReferenceCount: 6,
    sourceReferenceCount: 14,
    pairedCount: 5,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 5 overlapping models.",
    scale: {
      sourceAnchor: 69.25999999999999,
      targetAnchor: 73.04
    }
  },
  {
    id: "paired-mean-manual-v3:tau3-banking:automationbench",
    targetMetricId: "tau3-banking",
    sourceMetricId: "automationbench",
    targetSignature: '["tau3-banking","3.0","higher",false,"linear",0,100]',
    sourceSignature: '["automationbench","1.0.6","higher",false,"linear",0,100]',
    targetReferenceCount: 39,
    sourceReferenceCount: 10,
    pairedCount: 8,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 8 overlapping models.",
    scale: {
      sourceAnchor: 25.825000000000003,
      targetAnchor: 39.819602448453615
    }
  },
  {
    id: "paired-mean-manual-v3:tau3-banking:enterprise-ops-gym-aa",
    targetMetricId: "tau3-banking",
    sourceMetricId: "enterprise-ops-gym-aa",
    targetSignature: '["tau3-banking","3.0","higher",false,"linear",0,100]',
    sourceSignature: '["enterprise-ops-gym-aa","2026-09-05-scale-2","higher",false,"linear",20,100]',
    targetReferenceCount: 39,
    sourceReferenceCount: 12,
    pairedCount: 12,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 12 overlapping models.",
    scale: {
      sourceAnchor: 27.201457276434894,
      targetAnchor: 39.690728951890044
    }
  },
  {
    id: "paired-mean-manual-v3:scicode:terminal-bench-science",
    targetMetricId: "scicode",
    sourceMetricId: "terminal-bench-science",
    targetSignature: '["scicode","1.0-scale-2","higher",false,"linear",20,100]',
    sourceSignature: '["terminal-bench-science","0.1","higher",false,"linear",0,100]',
    targetReferenceCount: 36,
    sourceReferenceCount: 8,
    pairedCount: 8,
    method: "paired-mean",
    status: "ready",
    reason: "Ratio of mean primary to mean secondary points across 8 overlapping models.",
    scale: {
      sourceAnchor: 25.066666666666666,
      targetAnchor: 47.13903356481482
    }
  }
];

// src/data/calibrations.ts
var fallbackCalibrations = calibrations_default;
// src/engine/calibration.ts
var CALIBRATION_ALGORITHM = "paired-mean-manual-v3";
function metricSignature(metric, metrics = new Map) {
  if (metric.kind === "composite")
    return JSON.stringify([
      metric.id,
      metric.version,
      resolveEffectiveLeafWeights(metric.id, metrics).filter((leaf) => leaf.effectiveWeight > 0).map((leaf) => [leaf.effectiveWeight, metricSignature(metrics.get(leaf.rawMetricId))])
    ]);
  return JSON.stringify([
    metric.id,
    metric.version,
    metric.direction,
    metric.requiresVisionInput,
    metric.normalization.scale ?? "linear",
    metric.normalization.lowerAnchor,
    metric.normalization.upperAnchor
  ]);
}
function predictCalibration(scale, x) {
  return Math.max(0, Math.min(100, x * scale.targetAnchor / scale.sourceAnchor));
}
function buildCalibration(id2, target, source, preferredReferenceScores, fallbackReferenceScores, metrics = new Map([[target.id, target], [source.id, source]]), manual) {
  const sources = new Map(fallbackReferenceScores.map((result2) => [result2.modelId, result2.score]));
  const pairs = preferredReferenceScores.flatMap((result2) => {
    const sourceScore = sources.get(result2.modelId);
    return sourceScore === undefined ? [] : [{ primary: result2.score, secondary: sourceScore }];
  });
  const result = {
    id: id2,
    targetMetricId: target.id,
    sourceMetricId: source.id,
    targetSignature: metricSignature(target),
    sourceSignature: metricSignature(source, metrics),
    targetReferenceCount: preferredReferenceScores.length,
    sourceReferenceCount: fallbackReferenceScores.length,
    pairedCount: pairs.length,
    method: null,
    status: "manual-required",
    reason: "",
    scale: null
  };
  if (target.requiresVisionInput && !requiresVision(source, metrics)) {
    return { ...result, reason: "A text-only evaluation cannot establish native vision performance." };
  }
  const sourceAnchor = pairs.length ? pairs.reduce((sum, pair) => sum + pair.secondary, 0) / pairs.length : 0;
  if (pairs.length && sourceAnchor > 0) {
    return {
      ...result,
      status: "ready",
      method: "paired-mean",
      reason: `Ratio of mean primary to mean secondary points across ${String(pairs.length)} overlapping models.`,
      scale: { sourceAnchor, targetAnchor: pairs.reduce((sum, pair) => sum + pair.primary, 0) / pairs.length }
    };
  }
  if (manual?.targetMetricId === target.id && manual.sourceMetricId === source.id && manual.targetSignature === result.targetSignature && manual.sourceSignature === result.sourceSignature && Number.isFinite(manual.factor) && manual.factor >= 0) {
    return {
      ...result,
      status: "ready",
      method: "manual",
      reason: manual.rationale,
      scale: { sourceAnchor: 1, targetAnchor: manual.factor }
    };
  }
  return { ...result, reason: manual ? "Manual calibration does not match the current benchmark definitions; review and recalibrate." : pairs.length ? "The paired secondary mean is zero; manual calibration required." : "No overlapping direct model measurements; manual calibration required." };
}

// src/engine/benchmarkResolver.ts
function resolveBenchmark(model, target, effectiveWeight, metrics, observations, calibrations, crossEffort) {
  const primary = observations.get(`${model.id}:${target.id}`);
  const result = {
    rawMetric: target,
    rawValue: primary?.value ?? null,
    state: "missing",
    hasEvidence: false,
    normalizedValue: 0,
    effectiveWeight,
    pointsContributed: 0,
    explanation: "No usable result."
  };
  if (target.requiresVisionInput && model.visionInput === "unsupported") {
    if (primary)
      return { ...result, explanation: "Vision metadata conflicts with a recorded image evaluation; review required." };
    return { ...result, state: "unsupported", hasEvidence: true, explanation: "Cannot accept required image input; assigned zero points." };
  }
  if (primary) {
    const normalizedValue = normalizeRawValue(primary.value, target);
    return {
      ...result,
      state: "measured",
      hasEvidence: true,
      sourceObservation: primary,
      sourceMetric: target,
      normalizedValue,
      pointsContributed: normalizedValue * effectiveWeight,
      explanation: "Preferred benchmark measurement."
    };
  }
  const pendingSources = [];
  for (const sourceId of target.fallbackMetricIds ?? []) {
    const source = metrics.get(sourceId);
    if (!source || target.requiresVisionInput && !requiresVision(source, metrics))
      continue;
    const evidence = readFallbackSource(model, source, metrics, observations, ["quality", "knowledge", "vision"].includes(target.family) ? crossEffort : undefined);
    if (!evidence)
      continue;
    const calibration = calibrations.find((route) => route.targetMetricId === target.id && route.sourceMetricId === sourceId && route.targetSignature === metricSignature(target) && route.sourceSignature === metricSignature(source, metrics));
    if (calibration?.status !== "ready" || !calibration.scale) {
      pendingSources.push(source.name);
      continue;
    }
    const scaled = calibration.scale;
    const normalizedValue = predictCalibration(scaled, evidence.score);
    const usesCrossEffort = evidence.components.some((part) => part.state === "cross-effort");
    return {
      ...result,
      state: "estimated",
      hasEvidence: true,
      sourceMetric: source,
      sourceObservation: source.kind === "raw" ? evidence.components[0]?.observation : undefined,
      sourceComponents: source.kind === "composite" || evidence.components.some((part) => part.state !== "measured") ? evidence.components : undefined,
      normalizedValue,
      pointsContributed: normalizedValue * effectiveWeight,
      perfectVisionValue: predictCalibration(scaled, evidence.perfectVisionScore),
      calibrationId: calibration.id,
      estimateKind: usesCrossEffort ? "cross-effort" : "scaled",
      crossEffort: usesCrossEffort ? crossEffort : undefined,
      explanation: `Scale-adjusted from ${source.name} using ${calibration.method === "manual" ? "manual calibration" : `paired averages (${String(calibration.pairedCount)} models)`}.` + (usesCrossEffort && crossEffort ? ` Cross-effort estimate: missing source inputs use this release's real Top measurements × ${crossEffort.factor.toFixed(4)} before benchmark conversion.` : "") + (pendingSources.length ? ` Skipped ${pendingSources.join(", ")}: calibration required.` : "")
    };
  }
  return pendingSources.length ? { ...result, explanation: `Result recorded for ${pendingSources.join(", ")}; calibration required before it can contribute points or coverage.` } : result;
}

// src/engine/uncertainty.ts
var FALLBACK_MARGIN_POINTS = 10;
function calculateScoreUncertainty(leaves, isEligible) {
  if (!isEligible)
    return {
      status: "unavailable",
      margin: null,
      method: "none",
      explanation: "Less than 95% coverage; the score remains provisional."
    };
  const fallbackWeight = leaves.filter((leaf) => leaf.state === "estimated" && leaf.estimateKind !== "cross-effort").reduce((sum, leaf) => sum + leaf.effectiveWeight, 0);
  const crossEffortWeight = leaves.filter((leaf) => leaf.estimateKind === "cross-effort").reduce((sum, leaf) => sum + leaf.effectiveWeight, 0);
  const coverageGap = leaves.filter((leaf) => leaf.state === "missing").reduce((sum, leaf) => sum + leaf.effectiveWeight * 100, 0);
  if (fallbackWeight === 0 && crossEffortWeight === 0 && coverageGap === 0)
    return {
      status: "not-needed",
      margin: null,
      method: "none",
      explanation: "No substitution or missing-coverage allowance applies. Direct benchmark measurement noise is not quantified."
    };
  const fallbackMargin = fallbackWeight * FALLBACK_MARGIN_POINTS;
  const crossEffortMargin = crossEffortWeight * FALLBACK_MARGIN_POINTS;
  const coverageMargin = coverageGap / 2;
  return {
    status: "available",
    margin: fallbackMargin + crossEffortMargin + coverageMargin,
    method: "policy",
    explanation: `Substitution allowance: ${fallbackMargin.toFixed(2)} points (${String(FALLBACK_MARGIN_POINTS)} × fallback weight).` + (crossEffortWeight > 0 ? ` Plus ${crossEffortMargin.toFixed(2)} points (${String(FALLBACK_MARGIN_POINTS)} × cross-effort estimated weight).` : "") + (coverageGap > 0 ? ` Plus ${coverageMargin.toFixed(2)} points, half the ${coverageGap.toFixed(2)}-point coverage gap. Missing components retain zero score contribution.` : "") + " Benchmark disagreement does not increase this allowance. This is an editorial uncertainty indicator, not a statistical confidence interval or a bound on possible results."
  };
}

// src/engine/observations.ts
var OBSERVATION_SELECTION_POLICY = "exact-reasoning-configuration-unspecified-top-v2";
function selectBestObservations(models, metrics, observations) {
  const modelMap = new Map(models.map((model) => [model.id, model]));
  const selected = new Map;
  for (const observation of observations) {
    const model = modelMap.get(observation.modelId);
    const metric = metrics.get(observation.metricId);
    if (!model || metric?.kind !== "raw")
      continue;
    const mode = model.isReasoningModel ? "reasoning" : "non-reasoning";
    if (observation.reasoningMode && observation.reasoningMode !== mode)
      continue;
    if (!matchesReasoningConfiguration(model, observation))
      continue;
    const key = `${model.id}:${metric.id}`;
    const previous = selected.get(key);
    if (!previous || (metric.direction === "higher" ? observation.value > previous.value : observation.value < previous.value)) {
      selected.set(key, observation);
    }
  }
  return selected;
}

// src/engine/crossEffort.ts
var CROSS_EFFORT_POLICY = "same-release-top-paired-capability-means-v1";
var isCapability = (metric) => ["quality", "knowledge", "vision"].includes(metric.family);
function buildCrossEffortCalibrations(models, metrics, observations) {
  const result = new Map;
  for (const model of models) {
    const config = model.reasoningConfiguration;
    if (!config || !["middle", "lowest"].includes(config.tier))
      continue;
    const top = models.find((candidate) => candidate.reasoningConfiguration?.releaseId === config.releaseId && candidate.reasoningConfiguration.tier === "top" && candidate.isReasoningModel === model.isReasoningModel);
    if (!top)
      continue;
    const pairs = [];
    for (const metric of metrics.values()) {
      if (metric.kind !== "raw" || !isCapability(metric))
        continue;
      if (metric.requiresVisionInput && (model.visionInput === "unsupported" || top.visionInput === "unsupported"))
        continue;
      const topObservation = observations.get(`${top.id}:${metric.id}`);
      const lowerObservation = observations.get(`${model.id}:${metric.id}`);
      if (!topObservation || !lowerObservation)
        continue;
      pairs.push({
        metricId: metric.id,
        topObservation,
        lowerObservation,
        topPoints: normalizeRawValue(topObservation.value, metric),
        lowerPoints: normalizeRawValue(lowerObservation.value, metric)
      });
    }
    const topSum = pairs.reduce((sum, pair) => sum + pair.topPoints, 0);
    if (!pairs.length || topSum <= 0)
      continue;
    result.set(model.id, {
      topModelId: top.id,
      topEffort: top.reasoningConfiguration?.effort ?? null,
      factor: pairs.reduce((sum, pair) => sum + pair.lowerPoints, 0) / topSum,
      pairs
    });
  }
  return result;
}
function estimateCrossEffort(missing, model, calibration, observations) {
  const target = missing.rawMetric;
  if (missing.state !== "missing" || !calibration || !isCapability(target) || target.requiresVisionInput && model.visionInput === "unsupported")
    return missing;
  const top = observations.get(`${calibration.topModelId}:${target.id}`);
  if (!top)
    return missing;
  const normalizedValue = Math.max(0, Math.min(100, normalizeRawValue(top.value, target) * calibration.factor));
  return {
    ...missing,
    state: "estimated",
    hasEvidence: true,
    rawValue: null,
    sourceObservation: top,
    sourceMetric: target,
    estimateKind: "cross-effort",
    crossEffort: calibration,
    normalizedValue,
    pointsContributed: normalizedValue * missing.effectiveWeight,
    explanation: `Cross-effort estimate from this release's Top result (${calibration.topEffort ?? "effort not published"}).` + ` Top normalized points × ${calibration.factor.toFixed(4)}, the ratio of lower/Top means across ${String(calibration.pairs.length)} shared measured capability benchmarks.`
  };
}

// src/engine/calculator.ts
function calculateIndexScores(rootMetricId, models, metricMap, observations, calibrations = fallbackCalibrations, evidenceModels = models) {
  const effectiveLeaves = resolveEffectiveLeafWeights(rootMetricId, metricMap);
  const obsMap = selectBestObservations(evidenceModels, metricMap, observations);
  const crossEffort = buildCrossEffortCalibrations(evidenceModels, metricMap, obsMap);
  const modelScores = models.map((model) => {
    let totalScore = 0;
    let coveredWeight = 0;
    let estimatedWeight = 0;
    let crossEffortWeight = 0;
    let unsupportedWeight = 0;
    let perfectVisionGain = 0;
    let hasAllRequiredObservations = true;
    const leafBreakdown = [];
    for (const leaf of effectiveLeaves) {
      const rawDef = metricMap.get(leaf.rawMetricId);
      const estimated = estimateCrossEffort(resolveBenchmark(model, rawDef, leaf.effectiveWeight, metricMap, obsMap, calibrations), model, crossEffort.get(model.id), obsMap);
      const resolved = estimated.state === "missing" && crossEffort.has(model.id) ? resolveBenchmark(model, rawDef, leaf.effectiveWeight, metricMap, obsMap, calibrations, crossEffort.get(model.id)) : estimated;
      totalScore += resolved.pointsContributed;
      const perfectVisionValue = resolved.state === "unsupported" ? 100 : resolved.perfectVisionValue ?? resolved.normalizedValue;
      perfectVisionGain += (perfectVisionValue - resolved.normalizedValue) * leaf.effectiveWeight;
      if (resolved.state === "measured")
        coveredWeight += leaf.effectiveWeight;
      if (resolved.state === "estimated")
        estimatedWeight += leaf.effectiveWeight;
      if (resolved.estimateKind === "cross-effort")
        crossEffortWeight += leaf.effectiveWeight;
      if (resolved.state === "unsupported")
        unsupportedWeight += leaf.effectiveWeight;
      if (resolved.state === "missing" && leaf.effectiveWeight > 0)
        hasAllRequiredObservations = false;
      leafBreakdown.push(resolved);
    }
    leafBreakdown.sort((a, b) => b.effectiveWeight - a.effectiveWeight);
    const evidencePercent = leafBreakdown.reduce((sum, leaf) => sum + (leaf.hasEvidence ? leaf.effectiveWeight : 0), 0) * 100;
    const isEligible = evidencePercent >= 95 - 0.0000000001;
    const coveragePercent = hasAllRequiredObservations ? 100 : Math.min(isEligible ? 99.9 : 94.9, Math.round(evidencePercent * 10) / 10);
    return {
      model,
      score: totalScore,
      rank: null,
      isEligible,
      coveragePercent,
      measuredPercent: coveredWeight * 100,
      estimatedPercent: estimatedWeight * 100,
      crossEffortEstimatedPercent: crossEffortWeight * 100,
      unsupportedPercent: unsupportedWeight * 100,
      perfectVisionScore: Math.min(100, totalScore + perfectVisionGain),
      uncertainty: calculateScoreUncertainty(leafBreakdown, isEligible),
      leafBreakdown
    };
  });
  const eligibleModels = modelScores.filter((m) => m.isEligible);
  const provisionalModels = modelScores.filter((m) => !m.isEligible);
  const scoreComparator = (a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const topLeafA = a.leafBreakdown[0]?.pointsContributed ?? 0;
    const topLeafB = b.leafBreakdown[0]?.pointsContributed ?? 0;
    if (topLeafB !== topLeafA) {
      return topLeafB - topLeafA;
    }
    return a.model.name.localeCompare(b.model.name);
  };
  eligibleModels.sort(scoreComparator);
  provisionalModels.sort(scoreComparator);
  let currentRank = 1;
  for (let i = 0;i < eligibleModels.length; i++) {
    if (i > 0 && eligibleModels[i].score < eligibleModels[i - 1].score) {
      currentRank = i + 1;
    }
    eligibleModels[i].rank = currentRank;
  }
  for (const prov of provisionalModels) {
    prov.rank = null;
  }
  return [...eligibleModels, ...provisionalModels];
}
// src/engine/calibrationSnapshot.ts
function generateFallbackCalibrations(models, metrics, observations, manualCalibrations = [], references = { models: [], observations: [] }) {
  const effortOrder = ["max", "xhigh", "high", "medium", "low"];
  const externalModels = references.models.filter((reference) => !models.some((model) => model.id === reference.id)).flatMap((reference) => {
    const records = references.observations.filter((observation) => observation.modelId === reference.id);
    const efforts = [...new Set(records.map(observationEffort).filter((effort) => effort !== null))].sort((a, b) => (effortOrder.includes(a) ? effortOrder.indexOf(a) : 99) - (effortOrder.includes(b) ? effortOrder.indexOf(b) : 99));
    return (efforts.length ? efforts : [null]).map((effort, index) => ({
      ...reference,
      id: index === 0 ? reference.id : `${reference.id}--reference-${encodeURIComponent(String(effort))}`,
      reasoningConfiguration: {
        releaseId: reference.id,
        effort,
        tier: index === 0 ? "top" : "lowest",
        basis: "documented-settings",
        sourceUrl: records[0]?.sourceUrl ?? ""
      }
    }));
  });
  const referenceModels = [...externalModels, ...models];
  const selected = selectBestObservations(referenceModels, metrics, [...assignReasoningObservations(referenceModels, references.observations), ...observations]);
  const referenceResults = (metric) => referenceModels.flatMap((model) => {
    const result = readFallbackSource(model, metric, metrics, selected);
    return result?.components.every((part) => part.state === "measured") ? [{ modelId: model.id, ...result }] : [];
  });
  const calibrations = [];
  const evidence = [];
  for (const target of metrics.values()) {
    if (target.kind !== "raw")
      continue;
    for (const sourceId of target.fallbackMetricIds ?? []) {
      const source = metrics.get(sourceId);
      if (!source)
        throw new Error(`Unknown fallback ${sourceId}`);
      const allPreferred = referenceResults(target);
      const allFallback = referenceResults(source);
      const pairedByRelease = new Map;
      for (const result of allPreferred) {
        if (!allFallback.some((entry) => entry.modelId === result.modelId))
          continue;
        const model = referenceModels.find((entry) => entry.id === result.modelId);
        const releaseId = model?.reasoningConfiguration?.releaseId ?? result.modelId;
        const previous = pairedByRelease.get(releaseId);
        if (!previous || result.score > previous.score)
          pairedByRelease.set(releaseId, result);
      }
      const pairedIds = new Set([...pairedByRelease.values()].map((result) => result.modelId));
      const preferredResults = allPreferred.filter((result) => pairedIds.has(result.modelId) || !allFallback.some((entry) => entry.modelId === result.modelId));
      const fallbackResults = allFallback.filter((result) => pairedIds.has(result.modelId) || !allPreferred.some((entry) => entry.modelId === result.modelId));
      calibrations.push(buildCalibration(`${CALIBRATION_ALGORITHM}:${target.id}:${source.id}`, target, source, preferredResults, fallbackResults, metrics, manualCalibrations.find((entry) => entry.targetMetricId === target.id && entry.sourceMetricId === source.id)));
      const pairedModelIds = preferredResults.filter((result) => fallbackResults.some((source2) => source2.modelId === result.modelId)).map((result) => result.modelId);
      evidence.push({ target, source, preferredResults, fallbackResults, pairedModelIds });
    }
  }
  return { calibrations, report: {
    algorithm: CALIBRATION_ALGORITHM,
    observationSelection: OBSERVATION_SELECTION_POLICY,
    models: referenceModels.map((model) => ({ id: model.id, name: model.name, leaderboard: models.some((entry) => entry.id === model.id) })),
    evidence
  } };
}
export {
  tokenPricing,
  selectBestObservations,
  resolveEffectiveLeafWeights,
  releaseObservations,
  reasoningProfiles_default as reasoningProfiles,
  publishedIndices,
  parseIndexCatalog,
  metricObservations as observations,
  normalizeRawValue,
  initialModels as models,
  modelCatalog,
  generateFallbackCalibrations,
  createCatalogMetricMap,
  indexCatalog_default as catalog,
  fallbackCalibrations as calibrations,
  calibrationReferences,
  calculateIndexScores,
  buildMetricMap,
  buildCrossEffortCalibrations,
  TOKEN_PRICE_BLEND,
  OBSERVATION_SELECTION_POLICY,
  FALLBACK_MARGIN_POINTS,
  CROSS_EFFORT_POLICY
};
