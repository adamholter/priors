import type { Model } from "@/data/types";
import { pairKey, type Answer, type BracketStep } from "./bracket";
import { selectedPairAgreement } from "./ranking-metric";

export type RankingEvidence = { order: string[]; weight: number };
export type AdaptiveOptions = { evidence: RankingEvidence[]; cap: number; threshold?: number };
type Edge = { above: string; below: string };

/** Match the whole family name, keeping class and suffix qualifiers. Parameter
 * counts such as 27B are sizes, not versions. Unknown formats get no assumption. */
function family(model: Model) {
 const match = /\d+(?:\.\d+)*/.exec(model.name);
 if (!match || /^[bm](?:\b|\s)/i.test(model.name.slice(match.index + match[0].length))) return null;
 const name = `${model.name.slice(0, match.index)}#${model.name.slice(match.index + match[0].length)}`.toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();
 return { key: `${model.labId}|${model.kind}|${name}`, version: match[0].split(".").map(Number) };
}
export function versionAssumptions(models: Model[]): Edge[] {
 const out: Edge[] = [];
 for (let i = 0; i < models.length; i++) for (let j = i + 1; j < models.length; j++) {
  const a = family(models[i]), b = family(models[j]);
  if (!a || !b || a.key !== b.key) continue;
  let difference = 0;
  for (let k = 0; k < Math.max(a.version.length, b.version.length); k++) {
   difference = (a.version[k] ?? 0) - (b.version[k] ?? 0);
   if (difference) break;
  }
  if (difference) out.push({ above: models[difference > 0 ? i : j].id, below: models[difference > 0 ? j : i].id });
 }
 return out;
}

const reaches = (edges: Edge[], from: string, to: string) => {
 const seen = new Set([from]), stack = [from];
 while (stack.length) {
  const id = stack.pop()!;
  for (const edge of edges) if (edge.above === id) {
   if (edge.below === to) return true;
   if (!seen.has(edge.below)) { seen.add(edge.below); stack.push(edge.below); }
  }
 }
 return false;
};

/** Stable topological order. A user's calls take precedence over assumptions.
 * The latest explicit answer wins if inconsistent calls form a cycle. */
function constrained(order: string[], edges: Edge[]) {
 const remaining = new Set(order), out: string[] = [];
 while (remaining.size) {
  const next = order.find(id => remaining.has(id) && !edges.some(e => e.below === id && remaining.has(e.above)));
  const id = next ?? [...remaining][0];
  out.push(id); remaining.delete(id);
 }
 return out;
}

function sides(a: string, b: string): [string, string] {
 let h = 2166136261;
 for (const c of pairKey(a, b)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
 return h & 1 ? [b, a] : [a, b];
}

/** Replayable active ranking. Evidence is a prior, never a hard performance rule.
 * Ask the unresolved pair with the greatest expected reduction in the solver's
 * top-weighted pair errors. Reweight evidence after each call and infer transitive
 * answers. A small local prior keeps near neighbors contestable when tests agree. */
export function runAdaptive(seeds: string[], models: Map<string, Model>, answers: Answer[], options: AdaptiveOptions, finish = false): BracketStep {
 const ids = [...new Set(seeds)], keep = new Set(ids);
 const calls = answers.filter(a => keep.has(a.a) && keep.has(a.b) && (!a.winner || a.winner === a.a || a.winner === a.b));
 const edges: Edge[] = [];
 for (const call of [...calls].reverse()) if (call.winner) {
  const loser = call.winner === call.a ? call.b : call.a;
  if (!reaches(edges, loser, call.winner)) edges.push({ above: call.winner, below: loser });
 }
 const assumptions = versionAssumptions(ids.flatMap(id => models.get(id) ? [models.get(id)!] : []));
 for (const edge of assumptions) if (!reaches(edges, edge.below, edge.above)) edges.push(edge);
 const seedOrder = constrained(ids, edges);
 const evidence = options.evidence.filter(e => e.order.filter(id => keep.has(id)).length >= Math.max(2, ids.length * .75)).map(e => ({ ...e, order: [...e.order.filter(id => keep.has(id)), ...ids.filter(id => !e.order.includes(id))] }));
 const samples: RankingEvidence[] = evidence.length ? [...evidence, { order: seedOrder, weight: 1 }] : [{ order: seedOrder, weight: 1 }];
 // Weak adjacent reversals express uncertainty, without treating distant ranks
 // as equally plausible or baking model names into question selection.
 for (let i = 0; i + 1 < seedOrder.length; i++) {
  const order = [...seedOrder]; [order[i], order[i + 1]] = [order[i + 1], order[i]];
  samples.push({ order, weight: (evidence.length || 1) * .045 / (i + 1) });
 }
 const posterior = samples.map(sample => {
  const pos = new Map(sample.order.map((id, i) => [id, i]));
  let weight = sample.weight;
  for (const call of calls) if (call.winner && !call.auto) {
   const loser = call.winner === call.a ? call.b : call.a;
   if (pos.get(call.winner)! > pos.get(loser)!) weight *= .08;
  }
  return { order: constrained(sample.order, edges), weight };
 });
 const total = posterior.reduce((n, s) => n + s.weight, 0) || 1;
 const expected = new Map(ids.map(id => [id, posterior.reduce((n, s) => n + s.order.indexOf(id) * s.weight, 0) / total]));
 const order = constrained([...ids].sort((a, b) => expected.get(a)! - expected.get(b)! || ids.indexOf(a) - ids.indexOf(b)), edges);
 const asked = calls.filter(a => !a.auto).length, seen = new Set(calls.map(a => pairKey(a.a, a.b)));
 const weightedTotal = selectedPairAgreement(order, new Map(order.map((id, i) => [id, (ids.length - i) * 3]))).weightedTotal || 1;
 let best: { pair: [string, string]; gain: number } | undefined;
 for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) {
  const a = order[i], b = order[j];
  if (seen.has(pairKey(a, b)) || reaches(edges, a, b) || reaches(edges, b, a)) continue;
  const p = posterior.reduce((n, s) => n + (s.order.indexOf(a) < s.order.indexOf(b) ? s.weight : 0), 0) / total;
  const uncertainty = Math.min(p, 1 - p);
  // The benefit includes pairs a result would settle through transitivity.
  let impact = 1 / ((i + 1) * (i + 1));
  for (let k = 0; k < order.length; k++) if (k !== i && k !== j) {
   const id = order[k];
   if (reaches(edges, b, id) || reaches(edges, id, a) || reaches(edges, a, id) || reaches(edges, id, b)) impact += .2 / Math.pow(Math.min(i, j, k) + 1, 2);
  }
  const gain = uncertainty * impact / weightedTotal;
  if (!best || gain > best.gain) best = { pair: sides(a, b), gain };
 }
 const done = finish || asked >= options.cap || !best || best.gain < (options.threshold ?? .0018);
 const loops = calls.filter(a => a.winner && order.indexOf(a.winner) > order.indexOf(a.winner === a.a ? a.b : a.a)).length;
 return { done, pair: done ? undefined : best?.pair, check: false, round: "The closest calls", level: 1, levels: 1, progress: done ? 1 : Math.min(.95, asked / options.cap), asked, unsure: calls.filter(a => !a.winner && !a.auto).length, blocks: [order], order, loops };
}
