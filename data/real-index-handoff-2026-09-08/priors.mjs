/** Optional, in-memory Priors Snapshot supplement. Does not read or write Priors files. */
export function createPriorsSupplement(dataset, formulas, { includeAssumedTop = true } = {}) {
  const ns = id => `real-index:${id}`;
  const metrics = new Map(formulas.metrics.map(metric => [metric.id, metric]));
  const nativeEfforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
  const organizations = [...new Set(dataset.models.map(model => model.organization))];
  return {
    labs: organizations.map(name => ({ id: ns(name), name, color: '#777777' })),
    // Keep identities isolated until the recipient explicitly maps exact releases/configurations.
    models: dataset.modelCatalog.map(model => ({ id: ns(model.id), name: model.name,
      labId: ns(model.organization), releaseDate: model.releaseDate, kind: 'llm',
      reasoning: model.isReasoningModel, aliases: [] })),
    variants: dataset.models.map(model => ({ id: ns(model.id),
      modelId: ns(model.reasoningConfiguration.releaseId),
      effort: nativeEfforts.has(model.reasoningConfiguration.effort) ? model.reasoningConfiguration.effort : 'default',
      configuration: JSON.stringify(model.reasoningConfiguration),
    })),
    benchmarks: formulas.metrics.filter(metric => metric.kind === 'raw').map(metric => ({
      id: ns(metric.id), name: `${metric.name} (Real Index points)`, shortName: metric.shortName,
      sourceId: 'real-index', url: metric.source.primarySourceUrl, description: metric.source.description,
      unit: 'score', normalization: { kind: 'linear', min: 0, max: 100 }, higherIsBetter: true,
      category: metric.family === 'latency' ? 'speed' : ['speed', 'cost', 'knowledge'].includes(metric.family) ? metric.family : 'other',
      proxy: metric.id === 'blended-token-price', defaultWeight: 0, eligibleForDefault: false,
    })),
    observations: dataset.bestObservations.filter(observation => includeAssumedTop || observation.effortAttribution !== 'assumed-top').map(observation => ({
      benchmarkId: ns(observation.metricId), variantId: ns(observation.modelId),
      value: normalize(observation.value, metrics.get(observation.metricId)),
      observedAt: observation.observationDate, sourceUrl: observation.sourceUrl,
      harness: observation.scaffoldOrHarness, note: observation.notes,
      details: { realIndex: { ...observation, evidenceKind: 'recorded-observation' } },
    })),
  };
}

// Reuse the shipped implementation so logarithmic and reversed scales are identical.
import { normalizeRawValue as normalize } from './engine.mjs';
