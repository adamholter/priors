import { identityBenchmark } from "./identity";

const baseline = process.argv.includes("--baseline");
const report = identityBenchmark(baseline);
console.log(JSON.stringify({ mode: baseline ? "before fix (frozen IDs)" : "current", ...report }, null, 2));
if (!baseline && !report.passedAll) process.exitCode = 1;
