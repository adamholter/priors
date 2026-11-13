// RWE-Bench results: every number on /rwe-bench comes from this file.
//
// Written by scripts/rwe-import.mjs from the export of 2026-10-25T08:17:44.467Z (rows for Fable 5.2, Gemini 4 Carbon, GPT-6.1 Terra and Nemotron 3.5 Super VL added by hand on 2026-11-12, computed with Oddish's own scoring):
//   npm run rwe:import -- <folder with the exported JSON files>
// A hand edit here works for a quick fix, but the next import replaces it; names, labs and domains live in
// scripts/rwe-catalog.json. The page sorts and ranks the models, finds the Pareto frontier, fits the chart's axes
// and fills every count in the text (the number of tasks too) from this file. `npm test` checks it.
//
//   pass1       average pass rate, %: the share of runs whose design passes every check, averaged over the tasks;
//               it sets the order and the rank (equal rates share a rank)
//   lo, hi      its 95% interval, % (see interval below)
//   passAtK     pass@1 to pass@5, %: the chance that at least 1 of k runs passes, averaged over the tasks
//   tasks       tasks the model was scored on; fewer than the total says so in Table 1
//   runs        runs scored, across those tasks
//   cost        mean API spend for 1 run on 1 task, USD          ┐ what Figure 1 can put on its x axis, per run;
//   time        mean time for 1 run, hours                       │ null leaves the model out of that view
//   inTokensM   mean input tokens for 1 run, millions            │
//   outTokensK  mean output tokens for 1 run, thousands          ┘
//   reported    for a measure not every run reported: how many did (the mean is theirs, and Figure 1 says so)
//   lab         a lab with a mark in /media/rwe/labs (see MARKS in public/js/rwe.js) shows it; any other lab shows none
window.RWE = {
  batch: 'Batch 1',
  date: '12.11.2026',       // export date (not shown on the page)
  resultsDate: '2026-11-12',  // the date the results are published as, from scripts/rwe-catalog.json (Table 1 shows it)
  provisional: true,     // runs were still going at export (not shown on the page)
  runs: 5,                 // runs per task, per model (at most)
  hours: 24,               // time limit for 1 run
  unsolved: 1,             // tasks no model passed in any run (a count only: which ones stays private)
  interval: '95% credible interval from a hierarchical model that pools the tasks',

  // tasks per domain; the total is their sum
  domains: [
    { name: 'Electrical Engineering', tasks: 5 },
    { name: 'Aerospace Engineering',  tasks: 6 },
    { name: 'Mechanical Engineering', tasks: 9 },
  ],

  models: [
    { name: 'Claude Fable 5.2',      lab: 'Anthropic',        harness: 'Claude Code', effort: 'max',   pass1: 62, lo: 55.2, hi: 68.2, passAtK: [62, 73, 77, 79, 80], tasks: 20, runs: 100, cost: 114.86, time: 5.45, inTokensM: 95.1, outTokensK: 999, reported: { cost: 99, time: 99, inTokensM: 99, outTokensK: 99 } },  // cost estimated from tokens at list price ($8 / $0.20 cached / $40 per MTok); none was recorded
    { name: 'GPT-6 Astra',         lab: 'OpenAI',          harness: 'Codex',       effort: 'max',   pass1: 37, lo: 30.7, hi: 43.8, passAtK: [37, 48.5, 55.5, 59, 60], tasks: 20, runs: 100, cost: 58.83, time: 2.81, inTokensM: 32.8,  outTokensK: 358,  reported: { time: 97 } },
    { name: 'Claude Opus 5.5',     lab: 'Anthropic',       harness: 'Claude Code', effort: 'max',   pass1: 29, lo: 21.9, hi: 37.6, passAtK: [29, 45.5, 56.5, 64, 70], tasks: 20, runs: 100, cost: 57.52, time: 4.23, inTokensM: 91.7,  outTokensK: 739,  reported: { time: 99 } },
    { name: 'GPT-6.1 Sol',         lab: 'OpenAI',          harness: 'Codex',       effort: 'max',   pass1: 25, lo: 18.8, hi: 31.9, passAtK: [25, 37, 44, 48, 50],     tasks: 20, runs: 100, cost: 10.28, time: 3.24, inTokensM: 40.7,  outTokensK: 454,  reported: { cost: 99, time: 96, inTokensM: 99, outTokensK: 99 } },
    { name: 'Gemini 4 Carbon',       lab: 'Google DeepMind',  harness: 'Antigravity', effort: 'high',  pass1: 20, lo: 14.1, hi: 26.9, passAtK: [20, 31.5, 38, 42, 45], tasks: 20, runs: 100, cost: 30.53, time: 7.13, inTokensM: 100.8, outTokensK: 499, reported: { cost: 99, time: 99, inTokensM: 99, outTokensK: 99 } },
    { name: 'GPT-6.1 Terra',         lab: 'OpenAI',           harness: 'Codex',      effort: 'max',   pass1: 19, lo: 13.8, hi: 25.4, passAtK: [19, 27.5, 33, 37, 40], tasks: 20, runs: 100, cost: 11.46, time: 2.73, inTokensM: 145.4, outTokensK: 554, reported: null },
    { name: 'Gemini 4 Argon',      lab: 'Google DeepMind', harness: 'Gemini CLI',  effort: 'high',  pass1: 12, lo: 7.5,  hi: 18.5, passAtK: [12, 20, 26, 31, 35],     tasks: 20, runs: 100, cost: 23.66, time: 2.48, inTokensM: 43.2,  outTokensK: 359,  reported: null },
    { name: 'Claude Fable 5.1',    lab: 'Anthropic',       harness: 'Claude Code', effort: 'max',   pass1: 7,  lo: 3.7,  hi: 12.2, passAtK: [7, 12, 15.5, 18, 20],    tasks: 20, runs: 100, cost: 97.57, time: 3.68, inTokensM: 36.5,  outTokensK: 652,  reported: null },
    { name: 'Kimi K3.1 Pro',       lab: 'Moonshot AI',     harness: 'Kimi Code',   effort: 'max',   pass1: 1,  lo: 0.1,  hi: 4.6,  passAtK: [1, 2, 3, 4, 5],          tasks: 20, runs: 99,  cost: 71.2,  time: 4.07, inTokensM: 297.6, outTokensK: 548,  reported: { cost: 94, time: 94, inTokensM: 96, outTokensK: 96 } },
    { name: 'DeepSeek V4.1 Flash', lab: 'DeepSeek',        harness: 'DSH',         effort: 'max',   pass1: 0,  lo: 0,    hi: 2.1,  passAtK: [0, 0, 0, 0, 0],          tasks: 20, runs: 100, cost: 1.03,  time: 2.03, inTokensM: 68,    outTokensK: 424,  reported: null },
    { name: 'Nemotron 3.5 Super VL', lab: 'NVIDIA',           harness: 'OpenHands',  effort: 'max',   pass1: 0, lo: 0, hi: 2.1, passAtK: [0, 0, 0, 0, 0], tasks: 20, runs: 100, cost: 2.93, time: 7.57, inTokensM: 40.8, outTokensK: 983, reported: { cost: 85, time: 99, inTokensM: 98, outTokensK: 98 } },
    { name: 'Qwen3.8 Max',         lab: 'Alibaba',         harness: 'Qwen Coder',  effort: 'xhigh', pass1: 0,  lo: 0,    hi: 2.1,  passAtK: [0, 0, 0, 0, 0],          tasks: 20, runs: 100, cost: 17.4,  time: 4.36, inTokensM: 53.1,  outTokensK: 349,  reported: { cost: 98, time: 99 } },
    { name: 'GLM-5.3',             lab: 'Z.ai',            harness: 'ZCode',       effort: 'max',   pass1: 0,  lo: 0,    hi: 2.2,  passAtK: [0, 0, 0, 0, 0],          tasks: 20, runs: 99,  cost: 22.66, time: 4.61, inTokensM: 141.2, outTokensK: 1029, reported: { time: 98 } },
    { name: 'Muse Wonder',         lab: 'Meta',            harness: 'Muse Code',   effort: 'max',   pass1: 0,  lo: 0,    hi: 2.1,  passAtK: [0, 0, 0, 0, 0],          tasks: 20, runs: 100, cost: 27.56, time: 2.71, inTokensM: 46.3,  outTokensK: 644,  reported: { cost: 89, time: 92, inTokensM: 89, outTokensK: 89 } },
    { name: 'Grok 4.7',            lab: 'xAI',             harness: 'Grok Build',  effort: 'xhigh', pass1: 0,  lo: 0,    hi: 2.1,  passAtK: [0, 0, 0, 0, 0],          tasks: 20, runs: 100, cost: 66.27, time: 3.71, inTokensM: 70.4,  outTokensK: 517,  reported: { cost: 95, time: 94, inTokensM: 95, outTokensK: 95 } },
  ],

  // in the export, but with no score yet
  unscored: [],
};
