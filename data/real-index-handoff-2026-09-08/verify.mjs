import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import console from 'node:console';
import * as engine from './engine.mjs';
import { createPriorsSupplement } from './priors.mjs';

const read = async name => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const manifest = await read('manifest.json');
for (const [name, expected] of Object.entries(manifest.files)) {
  assert.equal(createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex'), expected, name);
}
const dataset = await read('dataset.json');
const formulas = await read('formulas.json');
const map = new Map(formulas.metrics.map(metric => [metric.id, metric]));
const json = value => JSON.parse(JSON.stringify(value));
const enabledModels = dataset.models.filter(model => dataset.enabledModelIds.includes(model.id));
assert.deepEqual(json(engine.enabledModels), enabledModels);
assert.deepEqual(json(engine.performanceEstimates), dataset.performanceEstimates);
assert.deepEqual(json(engine.taskPerformance), dataset.taskPerformance);
// Node/V8 and Bun/JSC can differ in the final bits of Math.log results.
function equivalent(actual, expected, path = 'result') {
  if (typeof expected === 'number') {
    assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-10, `${path}: ${actual} != ${expected}`);
  } else if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', path);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${path} keys`);
    for (const key of Object.keys(expected)) equivalent(actual[key], expected[key], `${path}.${key}`);
  } else {
    assert.equal(actual, expected, path);
  }
}
assert.deepEqual(json(engine.observations), dataset.observations);
assert.deepEqual(json([...engine.selectBestObservations(dataset.models, map, dataset.observations).values()]), dataset.bestObservations);
let count = 0;
for (const group of await read('composite-scores.json')) {
  const scores = engine.calculateIndexScores(group.metricId, enabledModels, map, dataset.observations, formulas.calibrations, dataset.models)
    .map(({ model, ...result }) => ({ modelId: model.id, ...result }));
  equivalent(json(scores), group.scores, group.metricId);
  for (const score of scores) {
    assert.ok(Number.isFinite(score.score));
    assert.ok(Math.abs(score.leafBreakdown.reduce((sum, leaf) => sum + leaf.pointsContributed, 0) - score.score) < 1e-8);
  }
  count += scores.length;
}
const resolved = await read('resolved-benchmarks.json');
const recalculated = formulas.metrics.filter(metric => metric.kind === 'raw').flatMap(metric =>
  engine.calculateIndexScores(metric.id, dataset.models, map, dataset.observations, formulas.calibrations)
    .map(({ model, leafBreakdown }) => ({ modelId: model.id, metricId: metric.id, ...leafBreakdown[0] })));
equivalent(json(recalculated), resolved);
equivalent(json(engine.generateFallbackCalibrations(dataset.models, map, dataset.observations,
  formulas.catalog.manualCalibrations ?? [], dataset.calibrationReferences)), await read('calibration-evidence.json'));
const supplement = createPriorsSupplement(dataset, formulas);
assert.equal(supplement.observations.length, dataset.bestObservations.length);
const variants = new Set(supplement.variants.map(item => item.id));
const models = new Set(supplement.models.map(item => item.id));
const benchmarks = new Set(supplement.benchmarks.map(item => item.id));
assert.equal(variants.size, supplement.variants.length);
for (const variant of supplement.variants) assert.ok(models.has(variant.modelId));
for (const observation of supplement.observations) {
  assert.ok(variants.has(observation.variantId) && benchmarks.has(observation.benchmarkId));
  assert.ok(Number.isFinite(observation.value) && observation.value >= 0 && observation.value <= 100);
}
assert.ok(createPriorsSupplement(dataset, formulas, { includeAssumedTop: false }).observations
  .every(observation => observation.details.realIndex.effortAttribution !== 'assumed-top'));
console.log(`Verified file hashes, ${count} composite scores, ${resolved.length} benchmark resolutions, calibration evidence, and ${supplement.observations.length} Priors records.`);
