import { acceptExploration, explorationTemperature } from "./annealing";
import type { Snapshot } from "../data/types";
import { computeIndex, type IndexConfig } from "../engine";

export const PREFERRED = ["deepswe-1.1", "terminalbench-4", "arc-agi-3", "simplebench", "bsbench-v2", "aa-humanitys-last-exam", "aa-omniscience", "frontiermath-tier-4-v2"] as const;
export type FitPriorities = { baseline?: string[] };
export type FitUpdate = { exactMatch:boolean; matchedPositions:number; priorityMatched:number; priorityTotal:number; phase:"preparing"|"searching"|"simplifying"|"complete"; iteration:number; tested:number; agreement:number; matchedPairs:number; totalPairs:number; closeness:number; weights:Record<string,number>; ranking:Array<{modelId:string;score:number;variantId:string;coverage:number}>; config:IndexConfig; benchmarkCount:number; quality:number; mismatches:Array<{above:string;below:string}>; log:string; estimatedShare:number };
type Settings=Pick<IndexConfig,"strictness"|"estimateMissing"|"effortMatching">;
type Column={id:string;score:number[];present:boolean[]}; type Approx={loss:number[];weights:Record<string,number>}; type Exact={loss:number[];update:FitUpdate};
const SETTINGS:Settings[]=[{strictness:0,estimateMissing:true,effortMatching:"calibrated"},{strictness:20,estimateMissing:true,effortMatching:"calibrated"},{strictness:20,estimateMissing:false,effortMatching:"calibrated"},{strictness:50,estimateMissing:true,effortMatching:"calibrated"},{strictness:50,estimateMissing:false,effortMatching:"strict"},{strictness:100,estimateMissing:false,effortMatching:"strict"}];
const LEVELS=[1,5,15,30,60,100]; const yieldUi=()=>new Promise<void>(r=>setTimeout(r,0));
const compare=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0};
const rng=(seed:number)=>()=>((seed=Math.imul(seed^seed>>>15,1|seed)),((seed+Math.imul(seed^seed>>>7,61|seed))^seed)>>>0)/4294967296;

function normalize(raw:Record<string,number>){const e=Object.entries(raw).filter(([,w])=>w>0).sort(([a],[b])=>a.localeCompare(b));const max=Math.max(1,...e.map(([,w])=>w));return Object.fromEntries(e.map(([id,w])=>[id,Math.max(.1,Math.round(w/max*1000)/10)]));}
function config(snapshot:Snapshot,target:string[],raw:Record<string,number>,s:Settings):IndexConfig{const weights=normalize(raw),keep=new Set(target);return{id:"fit",name:"My fit",weights,required:[],optional:Object.keys(weights),cutoff:5,estimateMissing:s.estimateMissing,variants:"best",rankingVariants:"best",effortMatching:s.effortMatching,strictness:s.strictness,excludeModels:snapshot.models.filter(m=>!keep.has(m.id)).map(m=>m.id)}}
function eligible(snapshot:Snapshot,id:string,target:Set<string>){const b=snapshot.benchmarks.find(x=>x.id===id);if(!b||b.proxy||["cost","speed","composite"].includes(b.category)||/arena|image|subjective|price|cost|speed/i.test(`${b.id} ${b.name} ${b.description}`))return false;const modelByVariant=new Map(snapshot.variants.map(v=>[v.id,v.modelId]));const seen=new Set(snapshot.observations.filter(o=>o.benchmarkId===id).map(o=>modelByVariant.get(o.variantId)));let n=0;for(const m of target)if(seen.has(m))n++;return n>=Math.min(2,target.size)&&n/target.size>=.45}
export function selectedPairAgreement(target:string[],scores:Map<string,number>,priorities:FitPriorities={}){
 let matched=0,missing=0,weightedErrors=0,weightedTotal=0,priorityMatched=0,priorityTotal=0;
 const mismatches:Array<{above:string;below:string}>=[], priorityErrors=target.map(()=>0), rankErrors=target.map(()=>0);
 const baseline=new Map((priorities.baseline??target).map((id,i)=>[id,i]));
 for(const id of target)if(!scores.has(id))missing++;
 for(let i=0;i<target.length;i++)for(let j=i+1;j<target.length;j++){
  const above=target[i],below=target[j],a=scores.get(above),b=scores.get(below);
  const ok=a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b)&&a>b+1e-7;
  const explicit=!baseline.has(above)||!baseline.has(below)||baseline.get(above)!>baseline.get(below)!;
  const weight=1/((i+1)*(i+1));weightedTotal+=weight;
  if(explicit){priorityTotal++;if(ok)priorityMatched++;else priorityErrors[i]++;}
  if(ok)matched++;else{weightedErrors+=weight;rankErrors[i]++;mismatches.push({above,below});}
 }
 const ranked=target.filter(id=>scores.has(id)).sort((a,b)=>scores.get(b)!-scores.get(a)!);
 const matchedPositions=target.filter((id,i)=>ranked[i]===id&& !mismatches.some(p=>(p.above===id||p.below===id)&&scores.get(p.above)===scores.get(p.below))).length;
 return{matched,missing,mismatches,total:target.length*(target.length-1)/2,priorityErrors,rankErrors,priorityMatched,priorityTotal,weightedErrors,weightedTotal,matchedPositions};
}
function rankingLoss(p:ReturnType<typeof selectedPairAgreement>){return[p.missing,...p.priorityErrors,p.weightedErrors,p.total-p.matched]}
const rankingLossLength=(n:number)=>n+3;


function preference(raw:Record<string,number>,quality:Record<string,number>){const e=Object.entries(raw).filter(([,w])=>w>0),sum=e.reduce((n,[,w])=>n+w,0)||1;return{quality:e.reduce((n,[id,w])=>n+(Number.isFinite(quality[id])?quality[id]:50)*w,0)/sum,penalty:e.reduce((n,[id,w])=>n+(PREFERRED.includes(id as typeof PREFERRED[number])?0:w),0)/sum}}
function approximate(target:string[],columns:Column[],raw:Record<string,number>,quality:Record<string,number>,priorities:FitPriorities={}):Approx{const active=Object.entries(raw).filter(([,w])=>w>0),byId=new Map(columns.map(c=>[c.id,c])),scores=new Map<string,number>();for(let m=0;m<target.length;m++){let num=0,den=0;for(const[id,w]of active){const c=byId.get(id);if(c?.present[m]){num+=c.score[m]*w;den+=w}}if(den)scores.set(target[m],num/den)}const p=selectedPairAgreement(target,scores,priorities),pref=preference(raw,quality);return{weights:raw,loss:[...rankingLoss(p),active.length,pref.penalty,-pref.quality]}}
function exact(snapshot:Snapshot,target:string[],raw:Record<string,number>,s:Settings,quality:Record<string,number>,phase:FitUpdate["phase"],iteration:number,tested:number,log:string,priorities:FitPriorities={}):Exact{const cfg=config(snapshot,target,raw,s),result=computeIndex(snapshot,cfg),keep=new Set(target),rows=result.ranked.filter(r=>keep.has(r.model.id)),ranking=rows.map(r=>({modelId:r.model.id,score:r.score,variantId:r.variant.id,coverage:r.coverage})),p=selectedPairAgreement(target,new Map(ranking.map(r=>[r.modelId,r.score])),priorities),pref=preference(cfg.weights,quality);let estimated=0,total=0;for(const row of rows)for(const v of row.values){const w=cfg.weights[v.benchmarkId]??0;total+=w;if(v.estimated)estimated+=w}const estimatedShare=total?estimated/total:0,loss=[...rankingLoss(p),Object.keys(cfg.weights).length,pref.penalty,estimatedShare,-pref.quality];return{loss,update:{exactMatch:p.matched===p.total,matchedPositions:p.matchedPositions,priorityMatched:p.priorityMatched,priorityTotal:p.priorityTotal,phase,iteration,tested,agreement:p.total?p.matched/p.total*100:p.missing?0:100,matchedPairs:p.matched,totalPairs:p.total,closeness:p.weightedTotal?100*(1-p.weightedErrors/p.weightedTotal):100,weights:cfg.weights,ranking,config:cfg,benchmarkCount:Object.keys(cfg.weights).length,quality:pref.quality,mismatches:p.mismatches,log,estimatedShare}}}
function search(target:string[],columns:Column[],quality:Record<string,number>,seed:number,test:()=>void,priorities:FitPriorities={}){
 const random=rng(seed),walkRandom=rng(seed*7919+17);let best:Approx|undefined;
 const margin=(weights:Record<string,number>)=>{const active=Object.entries(weights).filter(([,w])=>w>0),byId=new Map(columns.map(c=>[c.id,c])),scores:number[]=[];for(let m=0;m<target.length;m++){let num=0,den=0;for(const[id,w]of active){const c=byId.get(id);if(c?.present[m]){num+=c.score[m]*w;den+=w}}scores[m]=den?num/den:NaN}let loss=0;for(let i=0;i<scores.length;i++)for(let j=i+1;j<scores.length;j++){const gap=scores[i]-scores[j];if(Number.isFinite(gap)&&gap<=1e-7)loss+=(1/(i+1))*(1e-4-gap)}return loss};
 const guided=(x:Approx)=>[...x.loss.slice(0,rankingLossLength(target.length)),margin(x.weights),...x.loss.slice(rankingLossLength(target.length))];
 const evaluate=(weights:Record<string,number>)=>{test();const x=approximate(target,columns,weights,quality,priorities);if(!best||compare(x.loss,best.loss)<0)best=x;return x};
 for(let restart=0;restart<12;restart++){
  const weights:Record<string,number>={};
  const shuffled=[...columns];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  for(const c of (restart===0?columns.filter(c=>PREFERRED.includes(c.id as typeof PREFERRED[number])):shuffled.slice(0,1+Math.floor(random()*Math.min(12,columns.length)))))weights[c.id]=LEVELS[Math.floor(random()*LEVELS.length)];
  let local=evaluate(weights);
  for(let pass=0;pass<6;pass++){
   let improved=false;
   for(const c of shuffled){let next=local;
    for(const level of [0,...LEVELS]){const trial={...local.weights};if(level)trial[c.id]=level;else delete trial[c.id];if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;const x=evaluate(trial);if(compare(x.loss,next.loss)<0)next=x;}
    if(next!==local){local=next;improved=true;}
   }
   if(!improved)break;
  }
  // Pairwise/random moves cross plateaus that one-coordinate descent cannot.
  // The margin tie-break points the walk toward flipping the remaining pairs,
  // while the published result still uses the exact lexicographic objective.
  for(let step=0;step<1400;step++){
   const trial={...local.weights};
   const changes=1+Math.floor(walkRandom()*3);
   for(let k=0;k<changes;k++){
    const c=shuffled[Math.floor(walkRandom()*shuffled.length)];
    if(!c)continue;
    if(walkRandom()<.12)delete trial[c.id];else trial[c.id]=1+Math.floor(walkRandom()*100);
   }
   if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;
   const x=evaluate(trial);
   if(acceptExploration(guided(local),guided(x),explorationTemperature(step,350),walkRandom))local=x;
  }
 }
 return best!;
}

export async function fitPriors(snapshot:Snapshot,target:string[],onUpdate:(u:FitUpdate)=>void,quality:Record<string,number>={},frameDelay=0,priorities:FitPriorities={}):Promise<FitUpdate>{
// Yield between exact candidates so the UI can animate measured states without inventing progress.
const show=async(u:FitUpdate)=>{onUpdate(u);if(frameDelay&&u.phase!=="preparing"&&u.phase!=="complete"&&!u.log.startsWith("Read "))await new Promise<void>(r=>setTimeout(r,frameDelay));};
const wanted=[...new Set(target)];if(wanted.length!==target.length||wanted.some(id=>!snapshot.models.some(m=>m.id===id&&m.kind==="llm")))throw new Error("Every preferred model must be a distinct known LLM in this snapshot.");if(wanted.length<2)throw new Error("Choose at least two models to fit.");const ids=snapshot.benchmarks.map(b=>b.id).filter(id=>eligible(snapshot,id,new Set(wanted)));if(!ids.length)throw new Error("No benchmark covers enough selected models.");ids.sort((a,b)=>Number(PREFERRED.includes(b as typeof PREFERRED[number]))-Number(PREFERRED.includes(a as typeof PREFERRED[number]))||a.localeCompare(b));const verifiedStarts:Exact[]=[];let tested=0,iteration=0,lastEmit=0;
// Memoized exact(): identical normalized weights under identical settings produce identical
// results; the search revisits the same mixes many times across passes and restarts.
const exactCache=new Map<string,Exact>();
const run=(raw:Record<string,number>,s:Settings,phase:FitUpdate["phase"],it:number,tst:number,log:string):Exact=>{
 const key=JSON.stringify([s.strictness,s.estimateMissing,s.effortMatching,normalize(raw)]);
 const hit=exactCache.get(key);
 if(hit)return{loss:hit.loss,update:{...hit.update,phase,iteration:it,tested:tst,log}};
 const r=exact(snapshot,wanted,raw,s,quality,phase,it,tst,log,priorities);exactCache.set(key,r);return r;
};
let best=run({[ids[0]]:100},SETTINGS[0],"preparing",iteration,tested,`Preparing ${ids.length} benchmarks.`);onUpdate(best.update);
for(let si=0;si<SETTINGS.length;si++){const s=SETTINGS[si],columns:Column[]=[];for(const id of ids){const one=run({[id]:100},s,"preparing",iteration,++tested,`Preparing ${id}`),map=new Map(one.update.ranking.map(r=>[r.modelId,r.score]));columns.push({id,score:wanted.map(m=>map.get(m)??0),present:wanted.map(m=>map.has(m))});if(performance.now()-lastEmit>100){await show({...best.update,phase:si===0?"preparing":"searching",iteration,tested,log:`Read ${columns.length}/${ids.length} tests, strictness ${s.strictness}.`});lastEmit=performance.now()}await yieldUi()}const finalists:Approx[]=[];for(let seed=1;seed<=4;seed++)finalists.push(search(wanted,columns,quality,si*101+seed,()=>tested++,priorities));
// Keep independent pools so new supplemental metrics cannot displace every useful starting mix.
for(const pool of [columns.filter(c=>!c.id.startsWith("real-index:")),columns.filter(c=>c.present.every(Boolean))]){
 if(pool.length&&pool.length<columns.length)finalists.push(search(wanted,pool,quality,si*101+41,()=>tested++,priorities));
}
finalists.sort((a,b)=>compare(a.loss,b.loss));for(const candidate of finalists){const verified=run(candidate.weights,s,"searching",++iteration,++tested,`Check ${si+1}/${SETTINGS.length}: ${s.effortMatching}, strictness ${s.strictness}`);verifiedStarts.push(verified);if(compare(verified.loss,best.loss)<0)best=verified;await show({...best.update,phase:"searching",iteration,tested,log:verified.update.log});await yieldUi()}}
// Refine each setting's strongest verified start before selecting a basin.
// Single-benchmark approximations can hide changes in the winning reasoning effort.
for(const settings of SETTINGS){
 const starts=verifiedStarts.filter(x=>x.update.config.strictness===settings.strictness&&x.update.config.estimateMissing===settings.estimateMissing&&x.update.config.effortMatching===settings.effortMatching).sort((a,b)=>compare(a.loss,b.loss));
 let local=starts[0];if(!local)continue;
 for(const id of ids){
  const current=local.update.weights[id]??0;
  for(const level of current?[0,current*.5,current*.8,current*1.25,current*2]:[5,20,60]){
   const weights={...local.update.weights};if(level)weights[id]=level;else delete weights[id];
   if(!Object.keys(weights).length||Object.keys(weights).length>12)continue;
   const candidate=run(weights,settings,"searching",++iteration,++tested,"Refining another starting mix");
   if(compare(candidate.loss,local.loss)<0)local=candidate;
   if(compare(candidate.loss,best.loss)<0){best=candidate;await show(best.update)}
  }
  await yieldUi();
 }
 verifiedStarts.push(local);
}
// Refine against the full engine, because a model's best effort can change with the mix.
for(let pass=0;pass<3;pass++){
 const refineIds=[...new Set([...Object.keys(best.update.weights),...ids])];
 for(const id of refineIds){
  const current=best.update.weights[id]??0;
  const levels=current?[0,Math.max(1,current-2),current+2,Math.max(1,Math.round(current*.5)),Math.max(1,Math.round(current*.8)),Math.round(current*1.25),Math.round(current*2)]:[5,20,60];
  for(const level of levels){
   const trial={...best.update.weights};if(level)trial[id]=level;else delete trial[id];
   if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;
   const candidate=run(trial,best.update.config,"searching",++iteration,++tested,`Refining ${id}`);
   if(compare(candidate.loss,best.loss)<0){best=candidate;await show(best.update)}
  }
  await yieldUi();
 }
}
// Search the full scoring engine too: the best reasoning effort can switch between mixes.
const exactRandom=rng(49271);let walk=best;
const exactGuide=(candidate:Exact)=>{
 const scores=new Map(candidate.update.ranking.map(r=>[r.modelId,r.score]));let margin=0;
 for(let i=0;i<wanted.length;i++)for(let j=i+1;j<wanted.length;j++){
  const gap=(scores.get(wanted[i])??-100)-(scores.get(wanted[j])??100);
  if(gap<=1e-7)margin+=(1e-4-gap)/(i+1);
 }
 const baseline=new Map((priorities.baseline??wanted).map((id,i)=>[id,i]));
 const priorityMargins=wanted.map(()=>0);
 for(let i=0;i<wanted.length;i++)for(let j=i+1;j<wanted.length;j++){
  if(baseline.has(wanted[i])&&baseline.has(wanted[j])&&baseline.get(wanted[i])!<baseline.get(wanted[j])!)continue;
  const gap=(scores.get(wanted[i])??-100)-(scores.get(wanted[j])??100);
  if(gap<=1e-7)priorityMargins[i]+=1e-4-gap;
 }
 const prefix=1+wanted.length,n=rankingLossLength(wanted.length);
 return[...candidate.loss.slice(0,prefix),...priorityMargins,...candidate.loss.slice(prefix,n),margin,...candidate.loss.slice(n)];
};
for(let step=0;step<2400&&!best.update.exactMatch;step++){
 if(step%300===0){
  // Different settings and benchmark supports provide separate basins to explore.
  const round=Math.floor(step/300);
  walk=round===0?best:verifiedStarts[(round*7)%verifiedStarts.length]??best;
  await show({...best.update,phase:"searching",tested,iteration,log:"Exploring a different starting mix."});
 }
 const trial={...walk.update.weights};
 for(let change=0;change<1+Math.floor(exactRandom()*3);change++){
  const id=ids[Math.floor(exactRandom()*ids.length)],w=trial[id]??0;
  if(exactRandom()<.1)delete trial[id];else trial[id]=Math.max(1,Math.round(w ? w*(.4+exactRandom()*1.5) : 1+exactRandom()*60));
 }
 if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;
 const candidate=run(trial,step%40===0?SETTINGS[Math.floor(exactRandom()*SETTINGS.length)]:walk.update.config,"searching",++iteration,++tested,"Refining the remaining disagreements");
 if(acceptExploration(exactGuide(walk),exactGuide(candidate),explorationTemperature(step,300),exactRandom))walk=candidate;
 if(compare(candidate.loss,best.loss)<0){best=candidate;await show(best.update)}
 if(step%30===0){await show({...best.update,phase:"searching",tested,iteration,log:"Read a new search path across model configurations."});await yieldUi()}
}
// Polish the basin reached by annealing with finer weights that survive URL round-tripping.
walk=best;
for(let pass=0;pass<2&&!best.update.exactMatch;pass++){
 for(const id of Object.keys(walk.update.weights)){
  const w=walk.update.weights[id];
  for(const value of [w-.5,w-.1,w+.1,w+.5,w*.9,w*1.1]){
   if(value<=0)continue;
   const candidate=run({...walk.update.weights,[id]:value},walk.update.config,"searching",++iteration,++tested,"Refining the final weights");
   if(compare(exactGuide(candidate),exactGuide(walk))<0)walk=candidate;
   if(compare(candidate.loss,best.loss)<0){best=candidate;await show(best.update)}
  }
  await yieldUi();
 }
}
let simple=best;for(const id of Object.keys(simple.update.weights).sort((a,b)=>(quality[a]??50)-(quality[b]??50))){if(simple.update.benchmarkCount<=1)break;const trial={...simple.update.weights};delete trial[id];const v=run(trial,simple.update.config,"simplifying",++iteration,++tested,`Trying without ${id}`);const removed=compare(v.loss.slice(0,rankingLossLength(wanted.length)),simple.loss.slice(0,rankingLossLength(wanted.length)))<=0;if(removed)simple=v;await show({...simple.update,phase:"simplifying",iteration,tested,log:`${removed?"Removed":"Kept"} ${id}`});await yieldUi()}const done=run(simple.update.weights,simple.update.config,"complete",iteration,tested,simple.update.exactMatch?"Matched your full requested order.":"No matching configuration found. Showing the closest result.").update;await show(done);return done}
