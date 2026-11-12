import { createValsSource } from "./_vals";

export default createValsSource({
  sourceId: "vals-index",
  slug: "vals_index",
  benchmarkId: "vals-index-v2",
  name: "Vals Index",
  shortName: "Vals Index",
  category: "composite",
  description: "GDP-weighted measure of agentic model performance across finance, coding, and legal tasks.",
  // Versions the index runs before their own pages do (those still show Finance Agent v2, EMB v1 and Code Migration v1).
  components: [
    {
      task: "finance_agent", label: /^Finance Agent v(\d+(?:\.\d+)+)$/, id: (v) => `vals-finance-agent-v${v}`, name: (v) => `Finance Agent v${v}`, shortName: "Finance Agent", category: "professional",
      description: "Vals AI's Finance Agent, at the version the Vals Index runs: an agent researches public-company filings with search and document tools to answer analyst questions.",
    },
    {
      task: "emb", label: /^EMB v(\d+(?:\.\d+)+)$/, id: (v) => `vals-excel-modeling-v${v}`, name: (v) => `Excel Modeling Benchmark v${v}`, shortName: "Excel Modeling", category: "professional",
      description: "Vals AI's Excel Modeling Benchmark, at the version the Vals Index runs: build and edit financial models in spreadsheets.",
    },
    {
      task: "code_migration", label: /^Code Migration v(\d+(?:\.\d+)+)$/, id: (v) => `vals-code-migration-v${v}`, name: (v) => `Code Migration v${v}`, shortName: "Code Migration", category: "coding",
      description: "Vals AI's Code Migration, at the version the Vals Index runs: reimplement real-world programs in another language.",
    },
  ],
});
