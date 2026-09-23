import { createValsSource } from "./_vals";

export default createValsSource({
  sourceId: "vals-web-search",
  slug: "web_search",
  payloadSlug: "web_search_backends",
  benchmarkId: "vals-web-search-index",
  name: "Web Search Index",
  shortName: "Web Search",
  category: "agentic",
  description: "Compares native model-provider search with independent web search tools on finance and legal research tasks.",
});
