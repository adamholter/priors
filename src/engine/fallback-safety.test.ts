import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../data/types';
import { computeIndex, type IndexConfig } from './index';
const config: IndexConfig = {id:'test',name:'Test',weights:{target:100},required:[],optional:['target','support'],cutoff:5,estimateMissing:false,variants:'all',effortMatching:'calibrated',strictness:0};
function fixture(): Snapshot {return {version:1,date:'2026-09-08',generatedAt:'',labs:[{id:'lab',name:'Lab',color:'#000'}],models:[{id:'a',name:'A',labId:'lab',kind:'llm',reasoning:true,aliases:[]}],variants:[{id:'a@max',modelId:'a',effort:'max'},{id:'a@low',modelId:'a',effort:'low'}],benchmarks:['target','support'].map(id=>({id,name:id,sourceId:'test',url:'',description:'',unit:'percent',higherIsBetter:true,category:'reasoning'})),observations:[],sources:[],series:[]};}
describe('imported fallback evidence boundaries',()=>{
 it('respects exact effort matching for imported cross-effort estimates',()=>{
  const s=fixture();s.estimates=[{benchmarkId:'target',variantId:'a@low',value:50,estimateKind:'cross-effort',evidence:['Paired source evidence']}];
  expect(computeIndex(s,config).ranked[0]?.values[0]).toMatchObject({estimated:true,estimateKind:'effort'});
  expect(computeIndex(s,config).ranked[0]?.values[0].raw).toBeUndefined();
  expect(computeIndex(s,{...config,effortMatching:'strict'}).ranked).toEqual([]);
  expect(computeIndex(s,{...config,strictness:100}).ranked).toEqual([]);
 });
 it('never uses an imported estimate as calibration evidence for another estimate',()=>{
  const s=fixture();s.observations=[{benchmarkId:'target',variantId:'a@max',value:100,observedAt:'',sourceUrl:''},{benchmarkId:'support',variantId:'a@max',value:80,observedAt:'',sourceUrl:''}];
  s.estimates=[{benchmarkId:'support',variantId:'a@low',value:40,estimateKind:'scaled',evidence:['Imported fallback']}];
  const low=computeIndex(s,{...config,weights:{target:50,support:50}}).ranked.find(r=>r.variant.id==='a@low');
  expect(low?.values.some(v=>v.benchmarkId==='target')).not.toBe(true);
 });
 it('does not chain an imported estimate through a raw fallback route',()=>{
  const s=fixture();s.benchmarks[0].estimationRoutes=[{sourceId:'support',factor:.5,method:'paired-average',evidenceId:'route'}];
  s.estimates=[{benchmarkId:'support',variantId:'a@max',value:80,estimateKind:'scaled',evidence:['Imported fallback']}];
  expect(computeIndex(s,config).ranked).toEqual([]);
 });
 it('keeps assumed Top effort evidence out of maximum strictness',()=>{
  const s=fixture();s.observations=[{benchmarkId:'target',variantId:'a@max',value:80,observedAt:'',sourceUrl:'',details:{realIndex:{effortAttribution:'assumed-top'}}}];
  expect(computeIndex(s,config).ranked[0]?.values[0].estimated).toBe(true);
  expect(computeIndex(s,{...config,strictness:100}).ranked).toEqual([]);
 });
 it('keeps AA source identifiers separate from reasoning-variant identifiers',()=>{
  const s=fixture();s.observations=[{benchmarkId:'target',variantId:'a@max',value:80,observedAt:'',sourceUrl:'https://artificialanalysis.ai/models/a',sourceModelId:'aa-model-uuid'}];
  const row=computeIndex(s,{...config,effortMatching:'strict'}).ranked[0];
  expect(row.values[0].sourceVariantId).toBe('a@max');expect(row.mixedEfforts).toBe(false);
 });
});
