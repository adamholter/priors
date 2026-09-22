import { expect, it } from 'vitest';
import { loadSnapshot } from '../data/load';
import { computeIndex } from '../engine';
import { decodeIndex, encodeIndex } from '../lib/url';
import { benchmarkQuality } from './quality';
import { fitPriors, selectedPairAgreement } from './optimizer';

it('escapes the earlier Sol/Opus/Muse fit and only publishes improving selected-model results', async () => {
  const snapshot = (await loadSnapshot('2026-09-08'))!;
  const baseline = ['gpt-6-astra','claude-fable-5.1','claude-fable-5','claude-opus-5','gpt-5.6-sol','gemini-3.8-flash','claude-opus-4.8','glm-5.3','gpt-5.6-terra','grok-4.6','gemini-3.7-flash','gpt-5.6-luna','grok-4.5','claude-sonnet-5'];
  const target = [...baseline];[target[3],target[4]]=[target[4],target[3]];target.splice(10,0,'muse-spark-1.3');
  let previous: number[] | undefined;
  const result = await fitPriors(snapshot,target,u=>{
    const p=selectedPairAgreement(target,new Map(u.ranking.map(r=>[r.modelId,r.score])),{baseline});
    const loss=[p.missing,...p.priorityErrors,p.weightedErrors,p.total-p.matched];
    if(previous){const index=loss.findIndex((n,i)=>n!==previous![i]);if(index>=0)expect(loss[index]).toBeLessThan(previous[index]);}
    previous=loss;
  },Object.fromEntries(benchmarkQuality(snapshot).map(q=>[q.id,q.score])),0,{baseline});
  const ranked=result.ranking.map(r=>r.modelId);
  expect(ranked.slice(0,5)).toEqual(target.slice(0,5));
  expect(ranked[10]).toBe('muse-spark-1.3');
  expect(result.priorityMatched).toBe(result.priorityTotal);
  expect(result.matchedPairs).toBeGreaterThanOrEqual(100); // Previous implementation reached 95.
  expect(result.benchmarkCount).toBeLessThanOrEqual(12);
  const decoded=decodeIndex(encodeIndex(result.config),'fit')!;
  // The published index ranks everyone — the lineup's relative order must survive.
  const inLineup=new Set(target);
  expect(computeIndex(snapshot,decoded).ranked.filter(r=>inLineup.has(r.model.id)).map(r=>r.model.id)).toEqual(result.ranking.map(r=>r.modelId));
},30000);
