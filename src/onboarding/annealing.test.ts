import { describe, expect, it } from 'vitest';
import { acceptExploration, explorationTemperature } from './annealing';

describe('escaping local minima', () => {
 it('crosses a worse intermediate state while preserving the best result', () => {
  // Position 0 is a strict local minimum; reaching position 2 requires crossing position 1.
  const losses = [[2], [3], [0]];
  let position=0,best=0;
  for(const next of [1,2]){
   if(acceptExploration(losses[position],losses[next],1,()=>.1))position=next;
   if(losses[position][0]<losses[best][0])best=position;
  }
  expect(position).toBe(2);expect(best).toBe(2);
  expect(acceptExploration([2],[3],0,()=>.1)).toBe(false);
 });
 it('cools and then reheats for another exploration round', () => {
  expect(explorationTemperature(0,300)).toBe(1.2);
  expect(explorationTemperature(299,300)).toBeCloseTo(.015);
  expect(explorationTemperature(300,300)).toBe(1.2);
 });
 it('always accepts improvements and keeps acceptance probabilistic for worse candidates', () => {
  expect(acceptExploration([0,2],[0,1],0,()=>1)).toBe(true);
  expect(acceptExploration([0,2],[1,0],.1,()=>.99)).toBe(false);
 });
});
