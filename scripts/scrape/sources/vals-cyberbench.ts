import { createValsSource } from "./_vals";

export default createValsSource({
  sourceId: "vals-cyberbench",
  slug: "cyber",
  benchmarkId: "vals-cyberbench-v1.1",
  name: "CyberBench v1.1",
  category: "safety",
  description: "Agent performance reproducing OSS-Fuzz vulnerabilities with proof-of-concept inputs and patching the underlying bugs.",
});
