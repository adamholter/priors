import { expect, it } from 'vitest';
import type { Snapshot } from '../data/types';
import { computeIndex } from '../engine';
import { decodeIndex, encodeIndex } from '../lib/url';
import { benchmarkQuality } from './quality';
import { fitPriors, selectedPairAgreement } from './optimizer';

function regressionSnapshot(baseline: string[], target: string[]): Snapshot {
  const modelIds = [...target, 'outside-lineup'];
  const benchmarks = ['deepswe-1.1', 'simplebench', 'terminalbench-4'].map(id => ({
    id, name: id, category: 'coding' as const, sourceId: 'fixture', url: '',
    description: '', unit: 'percent' as const, higherIsBetter: true,
  }));
  const oldOrder = [...baseline, 'muse-spark-1.3'];
  return {
    version: 1, date: '2026-09-08', generatedAt: '',
    labs: [{ id: 'fixture', name: 'Fixture', color: '#000' }],
    models: modelIds.map(id => ({ id, name: id, labId: 'fixture', kind: 'llm', reasoning: false, aliases: [] })),
    variants: modelIds.map(id => ({ id: `${id}@default`, modelId: id, effort: 'default' })),
    benchmarks,
    // The first benchmark repeats the old order. Neither remaining benchmark
    // matches the target alone, but their equal-weight mix does. The fitter must
    // escape the old basin instead of accepting a single-benchmark near match.
    observations: benchmarks.flatMap((benchmark, bi) => modelIds.map(id => {
      const position = target.indexOf(id);
      const offset = position % 2 ? 8 : -8;
      const value = position < 0 ? 5 : bi === 0
        ? 95 - oldOrder.indexOf(id) * 5
        : 95 - position * 5 + (bi === 1 ? offset : -offset);
      return { benchmarkId: benchmark.id, variantId: `${id}@default`, value, observedAt: '', sourceUrl: '' };
    })),
    series: [], sources: [],
  };
}

it('escapes the earlier Sol/Opus/Muse fit and only publishes improving selected-model results', async () => {
  const baseline = ['gpt-6-astra','claude-fable-5.1','claude-fable-5','claude-opus-5','gpt-5.6-sol','gemini-3.8-flash','claude-opus-4.8','glm-5.3','gpt-5.6-terra','grok-4.6','gemini-3.7-flash','gpt-5.6-luna','grok-4.5','claude-sonnet-5'];
  const target = [...baseline];[target[3],target[4]]=[target[4],target[3]];target.splice(10,0,'muse-spark-1.3');
  const snapshot = regressionSnapshot(baseline, target);
  for (const benchmark of snapshot.benchmarks) {
    const single = computeIndex(snapshot, { id: 'single', name: 'Single', weights: { [benchmark.id]: 100 }, required: [], optional: [], cutoff: 5, estimateMissing: false, variants: 'best' });
    expect(single.ranked.filter(r => target.includes(r.model.id)).map(r => r.model.id)).not.toEqual(target);
  }
  let previous: number[] | undefined;
  const result = await fitPriors(snapshot,target,u=>{
    const p=selectedPairAgreement(target,new Map(u.ranking.map(r=>[r.modelId,r.score])),{baseline});
    const loss=[p.missing,...p.priorityErrors,p.weightedErrors,p.total-p.matched];
    if(previous){const index=loss.findIndex((n,i)=>n!==previous![i]);if(index>=0)expect(loss[index]).toBeLessThan(previous[index]);}
    previous=loss;
  },Object.fromEntries(benchmarkQuality(snapshot).map(q=>[q.id,q.score])),0,{baseline});
  const ranked=result.ranking.map(r=>r.modelId);
  expect(result.exactMatch).toBe(true);
  expect(ranked).toEqual(target);
  expect(result.priorityMatched).toBe(result.priorityTotal);
  expect(result.matchedPairs).toBe(result.totalPairs);
  expect(result.benchmarkCount).toBeLessThanOrEqual(12);
  const decoded=decodeIndex(encodeIndex(result.config),'fit')!;
  // The published index ranks everyone — the lineup's relative order must survive.
  const inLineup=new Set(target);
  const published = computeIndex(snapshot,decoded).ranked.map(r=>r.model.id);
  expect(published.filter(id=>inLineup.has(id))).toEqual(ranked);
  expect(published).toContain('outside-lineup');
},10000);
