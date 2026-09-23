import { acceptExploration, explorationTemperature } from "./annealing";
import type { Snapshot } from "../data/types";
import { computeIndex, type IndexConfig } from "../engine";
import { PREFERRED, affinity, type BenchmarkQuality } from "./quality";
import { DEFAULT_FOCUS, FOCUSES, type FocusId } from "./focus";
import type { MixLibrary } from "./library";
import { maxMarginMix, sparseMixes } from "./lp";
import { sgdCandidates } from "./sgd";

export { PREFERRED };
export type FitPriorities = { baseline?: string[] };
export type FitOptions = { focus?: FocusId; library?: MixLibrary; budgetMs?: { soft: number; hard: number }; extraFits?: MixLibrary["fits"] };
export type FitUpdate = { exactMatch:boolean; matchedPositions:number; priorityMatched:number; priorityTotal:number; phase:"preparing"|"searching"|"simplifying"|"complete"; iteration:number; tested:number; agreement:number; matchedPairs:number; totalPairs:number; closeness:number; fitScore:number; provisional:boolean; weights:Record<string,number>; ranking:Array<{modelId:string;score:number;variantId:string;coverage:number}>; config:IndexConfig; benchmarkCount:number; quality:number; mismatches:Array<{above:string;below:string}>; log:string; estimatedShare:number; intruders?:string[] };
type Settings=Pick<IndexConfig,"strictness"|"estimateMissing"|"effortMatching">;
type Column={id:string;score:number[];present:boolean[]}; type Approx={loss:number[];weights:Record<string,number>}; type Exact={loss:number[];update:FitUpdate};
// The library's settings come first: its precomputed columns make the first pass nearly free.
export const SETTINGS:Settings[]=[{strictness:50,estimateMissing:true,effortMatching:"calibrated"},{strictness:20,estimateMissing:true,effortMatching:"calibrated"},{strictness:20,estimateMissing:false,effortMatching:"calibrated"},{strictness:50,estimateMissing:false,effortMatching:"strict"},{strictness:100,estimateMissing:false,effortMatching:"strict"}];
export const settingsKey=(s:Settings)=>`${s.strictness}|${s.estimateMissing?1:0}|${s.effortMatching}`;
export const LEVELS=[1,5,15,30,60,100]; const yieldUi=()=>new Promise<void>(r=>setTimeout(r,0));
const compare=(a:number[],b:number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0};
const rng=(seed:number)=>()=>((seed=Math.imul(seed^seed>>>15,1|seed)),((seed+Math.imul(seed^seed>>>7,61|seed))^seed)>>>0)/4294967296;

function normalize(raw:Record<string,number>){const e=Object.entries(raw).filter(([,w])=>w>0).sort(([a],[b])=>a.localeCompare(b));const max=Math.max(1,...e.map(([,w])=>w));return Object.fromEntries(e.map(([id,w])=>[id,Math.max(.1,Math.round(w/max*1000)/10)]));}
function config(snapshot:Snapshot,target:string[],raw:Record<string,number>,s:Settings):IndexConfig{const weights=normalize(raw);return{id:"fit",name:"My fit",weights,required:[],optional:[],cutoff:5,estimateMissing:s.estimateMissing,variants:"best",rankingVariants:"best",effortMatching:s.effortMatching,strictness:s.strictness}}
/** The lineup exclusion is a search accelerator — the published index ranks everyone. */
function publishable(cfg:IndexConfig):IndexConfig{return{...cfg,excludeModels:undefined}}
function eligible(snapshot:Snapshot,id:string,target:Set<string>){const b=snapshot.benchmarks.find(x=>x.id===id);if(!b||b.proxy||["cost","speed","composite","reliability"].includes(b.category)||/arena|image|subjective|price|cost|speed/i.test(`${b.id} ${b.name} ${b.description}`))return false;const modelByVariant=new Map(snapshot.variants.map(v=>[v.id,v.modelId]));const seen=new Set(snapshot.observations.filter(o=>o.benchmarkId===id).map(o=>modelByVariant.get(o.variantId)));let n=0;for(const m of target)if(seen.has(m))n++;return n>=Math.min(2,target.size)&&n/target.size>=.45}
export function selectedPairAgreement(target:string[],scores:Map<string,number>,priorities:FitPriorities={}){
 // A correctly ordered pair earns full credit only when separated by MARGIN index points —
 // enough of a gap that small benchmark changes won't flip it. Thin margins give partial
 // credit, so the score keeps climbing while the search widens gaps after the order is right.
 const MARGIN=3;
 let matched=0,missing=0,weightedErrors=0,weightedTotal=0,priorityMatched=0,priorityTotal=0,closenessNum=0;
 const mismatches:Array<{above:string;below:string}>=[], priorityErrors=target.map(()=>0), rankErrors=target.map(()=>0);
 const baseline=new Map((priorities.baseline??target).map((id,i)=>[id,i]));
 for(const id of target)if(!scores.has(id))missing++;
 for(let i=0;i<target.length;i++)for(let j=i+1;j<target.length;j++){
  const above=target[i],below=target[j],a=scores.get(above),b=scores.get(below);
  const finite=a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b);
  const ok=finite&&a!-b!>1e-7;
  const explicit=!baseline.has(above)||!baseline.has(below)||baseline.get(above)!>baseline.get(below)!;
  const weight=1/((i+1)*(i+1));weightedTotal+=weight;
  if(explicit){priorityTotal++;if(ok)priorityMatched++;else priorityErrors[i]++;}
  if(ok)matched++;else{weightedErrors+=weight;rankErrors[i]++;mismatches.push({above,below});}
  const gap=finite?a!-b!:NaN;
  closenessNum+=weight*(Number.isFinite(gap)?(gap>=0?Math.min(1,gap/MARGIN):Math.max(-.5,gap/MARGIN)):0);
 }
 const ranked=target.filter(id=>scores.has(id)).sort((a,b)=>scores.get(b)!-scores.get(a)!);
 const matchedPositions=target.filter((id,i)=>ranked[i]===id&& !mismatches.some(p=>(p.above===id||p.below===id)&&scores.get(p.above)===scores.get(p.below))).length;
 return{matched,missing,mismatches,total:target.length*(target.length-1)/2,priorityErrors,rankErrors,priorityMatched,priorityTotal,weightedErrors,weightedTotal,matchedPositions,closeness:weightedTotal?Math.max(0,100*closenessNum/weightedTotal):100};
}
function rankingLoss(p:ReturnType<typeof selectedPairAgreement>){return[p.missing,...p.priorityErrors,p.weightedErrors,p.total-p.matched]}
const rankingLossLength=(n:number)=>n+3;

/** Displayed fit: rank-weighted penalty for wrong pairs, plus small penalties for thin
 *  margins and extra benchmarks. A model missing from the ranking counts as wrong
 *  against every other model. */
export function fitScore(target:string[],scores:Map<string,number>,benchCount:number){
 let wrong=0,thin=0,wSum=0;
 for(let i=0;i<target.length;i++)for(let j=i+1;j<target.length;j++){
  const a=scores.get(target[i]),b=scores.get(target[j]);
  const correct=a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b)&&a-b>1e-7;
  if(!correct)wrong+=25/Math.sqrt(i+1);
 }
 // Thin margins between neighboring ranks cost a little; deep gaps are free.
 for(let i=0;i+1<target.length;i++){
  const a=scores.get(target[i]),b=scores.get(target[i+1]);
  if(a==null||b==null||!Number.isFinite(a)||!Number.isFinite(b)||a-b<=1e-7)continue;
  const w=1/(i+1);wSum+=w;thin+=w*Math.max(0,1-(a-b)/3);
 }
 const thinScore=wSum?5*thin/wSum:0,complexity=5*Math.min(1,Math.max(0,(benchCount-4)/8));
 return Math.max(0,Math.min(100,100-wrong-thinScore-complexity));
}


function preference(raw:Record<string,number>,quality:Record<string,number>,aff:Record<string,number>){const e=Object.entries(raw).filter(([,w])=>w>0),sum=e.reduce((n,[,w])=>n+w,0)||1;return{quality:e.reduce((n,[id,w])=>n+(Number.isFinite(quality[id])?quality[id]:50)*w,0)/sum,penalty:e.reduce((n,[id,w])=>n+(w/sum)*(1-(aff[id]??0)),0)}}
/** Surrogate score map for the target lineup: models below the measured-share floor count as missing. */
function approxScoresFor(target:string[],columns:Column[],weights:Record<string,number>,floor:number){const active=Object.entries(weights).filter(([,w])=>w>0),byId=new Map(columns.map(c=>[c.id,c])),sum=active.reduce((n,[,w])=>n+w,0)||1,scores=new Map<string,number>();for(let m=0;m<target.length;m++){let num=0,den=0;for(const[id,w]of active){const c=byId.get(id);if(c?.present[m]){num+=c.score[m]*w;den+=w}}if(den&&den/sum>=floor-1e-9)scores.set(target[m],num/den)}return scores}
function approximate(target:string[],columns:Column[],raw:Record<string,number>,quality:Record<string,number>,aff:Record<string,number>,floor:number,priorities:FitPriorities={}):Approx{const active=Object.entries(raw).filter(([,w])=>w>0),scores=approxScoresFor(target,columns,raw,floor);const p=selectedPairAgreement(target,scores,priorities),pref=preference(raw,quality,aff);return{weights:raw,loss:[...rankingLoss(p),active.length,pref.penalty,-pref.quality]}}
/** Models outside the lineup that land in the overall top places (top 5, or the lineup size if smaller). */
export const TOP_GUARD=5;
function intrudersIn(ranked:{model:{id:string}}[],keep:Set<string>){const top:string[]=[],seen=new Set<string>(),k=Math.min(TOP_GUARD,keep.size);for(const r of ranked){if(seen.has(r.model.id))continue;seen.add(r.model.id);top.push(r.model.id);if(top.length>=k)break}return top.filter(id=>!keep.has(id))}
function exact(snapshot:Snapshot,target:string[],raw:Record<string,number>,s:Settings,quality:Record<string,number>,aff:Record<string,number>,phase:FitUpdate["phase"],iteration:number,tested:number,log:string,priorities:FitPriorities={}):Exact{const cfg=config(snapshot,target,raw,s),result=computeIndex(snapshot,cfg),keep=new Set(target),intruders=intrudersIn(result.ranked,keep),rows=result.ranked.filter(r=>keep.has(r.model.id)),ranking=rows.map(r=>({modelId:r.model.id,score:r.score,variantId:r.variant.id,coverage:r.coverage})),p=selectedPairAgreement(target,new Map(ranking.map(r=>[r.modelId,r.score])),priorities),pref=preference(cfg.weights,quality,aff);let estimated=0,total=0;for(const row of rows)for(const v of row.values){const w=cfg.weights[v.benchmarkId]??0;total+=w;if(v.estimated)estimated+=w}const estimatedShare=total?estimated/total:0,loss=[intruders.length,...rankingLoss(p),Object.keys(cfg.weights).length,pref.penalty,estimatedShare,-pref.quality];
 // An unlisted model in the top places is a failure the user sees first: it outranks any order error.
 const display=Math.max(0,fitScore(target,new Map(ranking.map(r=>[r.modelId,r.score])),Object.keys(cfg.weights).length)-15*intruders.length);
 return{loss,update:{exactMatch:p.matched===p.total&&!intruders.length,intruders,matchedPositions:p.matchedPositions,fitScore:display,provisional:false,priorityMatched:p.priorityMatched,priorityTotal:p.priorityTotal,phase,iteration,tested,agreement:p.total?p.matched/p.total*100:p.missing?0:100,matchedPairs:p.matched,totalPairs:p.total,closeness:p.closeness,weights:cfg.weights,ranking,config:publishable(cfg),benchmarkCount:Object.keys(cfg.weights).length,quality:pref.quality,mismatches:p.mismatches,log,estimatedShare}}}
function search(target:string[],columns:Column[],quality:Record<string,number>,aff:Record<string,number>,floor:number,seedMixes:Record<string,number>[],seed:number,test:()=>void,priorities:FitPriorities,softOpen:()=>boolean,onProvisional?:(w:Record<string,number>)=>void){
 const random=rng(seed),walkRandom=rng(seed*7919+17);let best:Approx|undefined;
 const byId=new Map(columns.map(c=>[c.id,c]));
 const wOf=(id:string)=>Math.max(1e-3,aff[id]??0);
 // Affinity-weighted draw without replacement for restart seeds and walk moves.
 const drawMix=(rand:()=>number,count:number)=>{const pool=columns.map(c=>c.id);const out:string[]=[];while(pool.length&&out.length<count){const total=pool.reduce((n,id)=>n+wOf(id),0);let x=rand()*total,k=0;while(k<pool.length-1&&(x-=wOf(pool[k]))>0)k++;out.push(pool.splice(k,1)[0]!)}return out};
 const drawOne=(rand:()=>number)=>{const total=columns.reduce((n,c)=>n+wOf(c.id),0);let x=rand()*total;for(const c of columns){x-=wOf(c.id);if(x<=0)return c.id}return columns[columns.length-1].id};
 const byAff=[...columns].sort((a,b)=>wOf(b.id)-wOf(a.id));
 const locals:Approx[]=[];const seenLocals=new Set<string>();
 const keepLocal=(x:Approx)=>{const key=JSON.stringify(normalize(x.weights));if(!seenLocals.has(key)){seenLocals.add(key);locals.push(x)}};
 const margin=(weights:Record<string,number>)=>{const active=Object.entries(weights).filter(([,w])=>w>0),sum=active.reduce((n,[,w])=>n+w,0)||1,scores:number[]=[];for(let m=0;m<target.length;m++){let num=0,den=0;for(const[id,w]of active){const c=byId.get(id);if(c?.present[m]){num+=c.score[m]*w;den+=w}}scores[m]=den&&den/sum>=floor-1e-9?num/den:NaN}let loss=0;for(let i=0;i<scores.length;i++)for(let j=i+1;j<scores.length;j++){const gap=scores[i]-scores[j];if(Number.isFinite(gap)&&gap<=1e-7)loss+=(1/(i+1))*(1e-4-gap)}return loss};
 const guided=(x:Approx)=>[...x.loss.slice(0,rankingLossLength(target.length)),margin(x.weights),...x.loss.slice(rankingLossLength(target.length))];
 const evaluate=(weights:Record<string,number>)=>{test();const x=approximate(target,columns,weights,quality,aff,floor,priorities);if(!best||compare(x.loss,best.loss)<0){best=x;onProvisional?.(weights)}return x};
 for(let restart=0;restart<12&&softOpen();restart++){
  const weights:Record<string,number>={};
  const seedMix=seedMixes[restart];
  if(seedMix){for(const[id,w]of Object.entries(seedMix))if(byId.has(id)&&w>0)weights[id]=w}
  else for(const id of drawMix(random,1+Math.floor(random()*Math.min(12,columns.length))))weights[id]=LEVELS[Math.floor(random()*LEVELS.length)];
  if(!Object.keys(weights).length)continue;
  let local=evaluate(weights);
  // Descending-affinity descent with per-restart jitter: high-affinity benchmarks move
  // first, but each restart explores a slightly different basin.
  const jitter=new Map(byAff.map(c=>[c.id,wOf(c.id)*(.7+.6*random())]));
  const order=[...byAff].sort((a,b)=>jitter.get(b.id)!-jitter.get(a.id)!);
  for(let pass=0;pass<6&&softOpen();pass++){
   let improved=false;
   for(const c of order){let next=local;
    for(const level of [0,...LEVELS]){const trial={...local.weights};if(level)trial[c.id]=level;else delete trial[c.id];if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;const x=evaluate(trial);if(compare(x.loss,next.loss)<0)next=x;}
    if(next!==local){local=next;improved=true;}
   }
   if(!improved)break;
  }
  // Pairwise/random moves cross plateaus that one-coordinate descent cannot.
  // The margin tie-break points the walk toward flipping the remaining pairs,
  // while the published result still uses the exact lexicographic objective.
  for(let step=0;step<1400&&softOpen();step++){
   const trial={...local.weights};
   const changes=1+Math.floor(walkRandom()*3);
   for(let k=0;k<changes;k++){
    const c=drawOne(walkRandom);
    if(!c)continue;
    if(walkRandom()<.12)delete trial[c];else trial[c]=1+Math.floor(walkRandom()*100);
   }
   if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;
   const x=evaluate(trial);
   if(acceptExploration(guided(local),guided(x),explorationTemperature(step,350),walkRandom))local=x;
  }
  keepLocal(local);
 }
 locals.sort((a,b)=>compare(a.loss,b.loss));
 return locals.length?locals:(best?[best]:[]);
}

export async function fitPriors(snapshot:Snapshot,target:string[],onUpdate:(u:FitUpdate)=>void,quality:Record<string,number>={},frameDelay=0,priorities:FitPriorities={},options:FitOptions={}):Promise<FitUpdate>{
// Yield between exact candidates so the UI can animate measured states without inventing progress.
const show=async(u:FitUpdate)=>{onUpdate(u);if(frameDelay&&u.phase!=="preparing"&&u.phase!=="complete"&&!u.log.startsWith("Read "))await new Promise<void>(r=>setTimeout(r,frameDelay));};
const wanted=[...new Set(target)];if(wanted.length!==target.length||wanted.some(id=>!snapshot.models.some(m=>m.id===id&&m.kind==="llm")))throw new Error("Every preferred model must be a distinct known LLM in this snapshot.");if(wanted.length<2)throw new Error("Choose at least two models to fit.");const ids=snapshot.benchmarks.map(b=>b.id).filter(id=>eligible(snapshot,id,new Set(wanted)));if(!ids.length)throw new Error("No benchmark covers enough selected models.");ids.sort((a,b)=>Number(PREFERRED.includes(b as typeof PREFERRED[number]))-Number(PREFERRED.includes(a as typeof PREFERRED[number]))||a.localeCompare(b));const verifiedStarts:Exact[]=[];let tested=0,iteration=0,lastEmit=0;
const focus=FOCUSES.find(f=>f.id===options.focus)??FOCUSES.find(f=>f.id===DEFAULT_FOCUS)!;
const library=options.library;
const budget={...(options.budgetMs??{soft:12_000,hard:20_000})};
const t0=performance.now();
const softOpen=()=>performance.now()-t0<budget.soft,hardOpen=()=>performance.now()-t0<budget.hard;
const benches=new Map(snapshot.benchmarks.map(b=>[b.id,b]));
const aff=Object.fromEntries(ids.map(id=>[id,affinity({score:quality[id]??50} as BenchmarkQuality,focus,benches.get(id)!)]));
const wantedSet=new Set(ids);
const starter=Object.fromEntries(Object.entries(focus.starter).filter(([id])=>wantedSet.has(id)));
// Library mixes are scored by pair agreement of their stored ranking with the target;
// the top three plus the focus starter seed the first restarts of every search.
const libRanked=(library?.mixes?.[focus.id]??[]).map(m=>({weights:m.weights,loss:rankingLoss(selectedPairAgreement(wanted,new Map(Object.entries(m.ranking)),priorities))})).sort((a,b)=>compare(a.loss,b.loss));
// Every focus starter seeds a basin: they are designed-diverse mixes, so a lineup whose
// best mix sits outside the selected focus still has a nearby starting point.
const otherStarters=FOCUSES.filter(f=>f.id!==focus.id).map(f=>Object.fromEntries(Object.entries(f.starter).filter(([id])=>wantedSet.has(id))));
const seedMixes=[starter,...otherStarters,...libRanked.slice(0,3).map(m=>m.weights)].filter(m=>Object.keys(m).length>0);
if(seedMixes.length<4){const preferredMix=Object.fromEntries(ids.filter(id=>(PREFERRED as readonly string[]).includes(id)).map(id=>[id,30]));if(Object.keys(preferredMix).length)seedMixes.push(preferredMix);}
let lastProvEmit=0;
// Memoized exact(): identical normalized weights under identical settings produce identical
// results; the search revisits the same mixes many times across passes and restarts.
const exactCache=new Map<string,Exact>();
const run=(raw:Record<string,number>,s:Settings,phase:FitUpdate["phase"],it:number,tst:number,log:string):Exact=>{
 const key=JSON.stringify([s.strictness,s.estimateMissing,s.effortMatching,normalize(raw)]);
 const hit=exactCache.get(key);
 if(hit){return{loss:hit.loss,update:{...hit.update,phase,iteration:it,tested:tst,log}};}
 const r=exact(snapshot,wanted,raw,s,quality,aff,phase,it,tst,log,priorities);exactCache.set(key,r);return r;
};
let best=run({[ids[0]]:100},SETTINGS[0],"preparing",iteration,tested,`Preparing ${ids.length} benchmarks.`);onUpdate(best.update);
// Offline fits for this exact lineup (the default, popular lineups) are verified first under their own settings.
const sameLineup=(l:string[])=>l.length===wanted.length&&l.every((id,i)=>id===wanted[i]);
const storedFits=[...(library?.fits??[]),...(options.extraFits??[])].filter(f=>sameLineup(f.lineup)).sort((a,b)=>Number(b.focus===focus.id)-Number(a.focus===focus.id)||Number(b.exact)-Number(a.exact)||b.fitScore-a.fitScore);
for(const f of storedFits.slice(0,6)){const known=SETTINGS.find(x=>settingsKey(x)===settingsKey(f.settings))??SETTINGS[0];const v=run(f.weights,known,"searching",++iteration,++tested,"Checking a known fit for this lineup.");verifiedStarts.push(v);if(compare(v.loss,best.loss)<0)best=v;}
if(storedFits.length)await show({...best.update,phase:"searching",iteration,tested});
for(let si=0;si<SETTINGS.length&&softOpen()&&!best.update.exactMatch;si++){const s=SETTINGS[si],floor=(s.strictness??50)/100,columns:Column[]=[];
const useLibrary=library&&library.settingsKey===settingsKey(s);
for(const id of ids){
 const libCol=useLibrary?library.columns[id]:undefined;
 if(libCol){columns.push({id,score:wanted.map(m=>libCol[m]??0),present:wanted.map(m=>m in libCol)});continue}
 const one=run({[id]:100},s,"preparing",iteration,++tested,`Preparing ${id}`),map=new Map(one.update.ranking.map(r=>[r.modelId,r.score]));columns.push({id,score:wanted.map(m=>map.get(m)??0),present:wanted.map(m=>map.has(m))});if(performance.now()-lastEmit>100){await show({...best.update,phase:si===0?"preparing":"searching",iteration,tested,log:`Read ${columns.length}/${ids.length} tests, strictness ${s.strictness}.`});lastEmit=performance.now()}await yieldUi()}
const provisional=(weights:Record<string,number>)=>{const now=performance.now();if(now-lastProvEmit<120)return;lastProvEmit=now;const display=fitScore(wanted,approxScoresFor(wanted,columns,weights,floor),Object.keys(weights).length);if(display<=best.update.fitScore)return;onUpdate({...best.update,provisional:true,fitScore:display,weights})};
// Max-margin LP over the surrogate columns: cheap, deterministic starts that widen every neighbouring gap.
const bonus=columns.map(c=>aff[c.id]??0),lpStarts=[...sparseMixes(columns,wanted.length,floor,bonus),...[maxMarginMix(columns,wanted.length,floor,bonus)].filter(x=>!!x)].map(x=>x!.weights);
// Seed mixes (focus starter + library picks) and LP starts are designed candidates — verify them directly.
const designed=[...lpStarts,...seedMixes];
for(const weights of designed){if(!hardOpen()||best.update.exactMatch)break;const verified=run(weights,s,"searching",++iteration,++tested,`Check ${si+1}/${SETTINGS.length}: ${s.effortMatching}, strictness ${s.strictness}`);verifiedStarts.push(verified);if(compare(verified.loss,best.loss)<0)best=verified;await show({...best.update,phase:"searching",iteration,tested,log:verified.update.log});await yieldUi()}
// Once the order is matched, the refinement passes below polish it; skip the broad search.
if(best.update.exactMatch)break;
// Gradient rounds: annealed descent on the surrogate, verified by the exact engine, whose per-model
// residuals correct the surrogate for the next round (effort choice and pool normalization shift scores).
let sliceOpen=softOpen;
{let offsets=wanted.map(()=>0),warm:Record<string,number>[]=[...lpStarts.slice(0,1),...seedMixes.slice(0,2)];
// Each setting gets a fair slice of the soft budget so the later ones are still explored.
sliceOpen=()=>softOpen()&&performance.now()-t0<budget.soft*(si+1)/SETTINGS.length;
for(let round=0;round<6&&sliceOpen()&&!best.update.exactMatch;round++){
 let roundBest:Exact|undefined;
 for(const weights of sgdCandidates(columns,wanted.length,{floor,bonus,offsets,inits:warm,seed:si*31+round+1}).slice(0,8)){if(!hardOpen())break;const v=run(weights,s,"searching",++iteration,++tested,"Taking a gradient step across the benchmarks.");verifiedStarts.push(v);if(!roundBest||compare(v.loss,roundBest.loss)<0)roundBest=v;if(compare(v.loss,best.loss)<0){best=v;await show(best.update)}if(best.update.exactMatch)break}
 if(!roundBest)break;
 const sur=approxScoresFor(wanted,columns,roundBest.update.weights,floor),ex=new Map(roundBest.update.ranking.map(r=>[r.modelId,r.score]));
 offsets=wanted.map((id,m)=>{const a=ex.get(id),b=sur.get(id);return a!=null&&b!=null?.3*offsets[m]+.7*(a-b):offsets[m]});
 warm=[roundBest.update.weights];
 await show({...best.update,phase:"searching",iteration,tested});await yieldUi();
}}
if(best.update.exactMatch)break;
const finalists:Approx[]=[];for(let seed=1;seed<=4&&sliceOpen();seed++)finalists.push(...search(wanted,columns,quality,aff,floor,seedMixes,si*101+seed,()=>tested++,priorities,sliceOpen,provisional));
// Keep independent pools so new supplemental metrics cannot displace every useful starting mix.
for(const pool of [columns.filter(c=>!c.id.startsWith("real-index:")),columns.filter(c=>c.present.every(Boolean))]){
 if(pool.length&&pool.length<columns.length&&sliceOpen())finalists.push(...search(wanted,pool,quality,aff,floor,seedMixes,si*101+41,()=>tested++,priorities,sliceOpen,provisional));
}
finalists.sort((a,b)=>compare(a.loss,b.loss));
const toVerify=finalists.slice(0,40);
for(const candidate of toVerify){if(!hardOpen())break;const verified=run(candidate.weights,s,"searching",++iteration,++tested,`Check ${si+1}/${SETTINGS.length}: ${s.effortMatching}, strictness ${s.strictness}`);verifiedStarts.push(verified);if(compare(verified.loss,best.loss)<0)best=verified;await show({...best.update,phase:"searching",iteration,tested,log:verified.update.log});await yieldUi()}}
await show({...best.update,phase:"searching",iteration,tested,log:best.update.exactMatch?"Refining the match.":"Refining the remaining disagreements"});
// A matched order only needs a short polish (wider margins, fewer benchmarks), not the full budget.
if(best.update.exactMatch)budget.hard=Math.min(budget.hard,performance.now()-t0+2500);
// Search the full scoring engine too: the best reasoning effort can switch between mixes.
// Anneal first — the heavyweight refines below run inside the remaining hard budget.
let converged=false;
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
 const prefix=2+wanted.length,n=1+rankingLossLength(wanted.length);
 return[...candidate.loss.slice(0,prefix),...priorityMargins,...candidate.loss.slice(prefix,n),margin,...candidate.loss.slice(n)];
};
const idsAff=ids.map(id=>Math.max(1e-3,aff[id]??0)),idsAffTotal=idsAff.reduce((a,b)=>a+b,0);
const drawExactId=()=>{let x=exactRandom()*idsAffTotal;for(let i=0;i<ids.length;i++){x-=idsAff[i];if(x<=0)return ids[i]}return ids[ids.length-1]};
for(let step=0;step<2400&&softOpen()&&!best.update.exactMatch&&!converged;step++){
 if(step%300===0){
  // Different settings and benchmark supports provide separate basins to explore.
  const round=Math.floor(step/300);
  walk=round===0?best:verifiedStarts[(round*7)%verifiedStarts.length]??best;
  await show({...best.update,phase:"searching",tested,iteration,log:"Exploring a different starting mix."});
 }
 const trial={...walk.update.weights};
 for(let change=0;change<1+Math.floor(exactRandom()*3);change++){
  const id=drawExactId(),w=trial[id]??0;
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
for(let pass=0;pass<2&&hardOpen()&&!best.update.exactMatch&&!converged;pass++){
 for(const id of Object.keys(walk.update.weights)){
  if(!hardOpen())break;
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
// Refine each setting's strongest verified start before selecting a basin.
// Single-benchmark approximations can hide changes in the winning reasoning effort.
for(const settings of SETTINGS){
 if(!hardOpen())break;
 const starts=verifiedStarts.filter(x=>x.update.config.strictness===settings.strictness&&x.update.config.estimateMissing===settings.estimateMissing&&x.update.config.effortMatching===settings.effortMatching).sort((a,b)=>compare(a.loss,b.loss));
 let local=starts[0];if(!local)continue;
 for(const id of ids){
  if(!hardOpen())break;
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
// An exact match that survives a full pass unchanged has converged: stop early.
for(let pass=0;pass<3&&hardOpen()&&!converged;pass++){
 let improved=false;
 const refineIds=[...new Set([...Object.keys(best.update.weights),...ids])];
 for(const id of refineIds){
  if(!hardOpen())break;
  const current=best.update.weights[id]??0;
  const levels=current?[0,Math.max(1,current-2),current+2,Math.max(1,Math.round(current*.5)),Math.max(1,Math.round(current*.8)),Math.round(current*1.25),Math.round(current*2)]:[5,20,60];
  for(const level of levels){
   const trial={...best.update.weights};if(level)trial[id]=level;else delete trial[id];
   if(!Object.keys(trial).length||Object.keys(trial).length>12)continue;
   const candidate=run(trial,best.update.config,"searching",++iteration,++tested,`Refining ${id}`);
   if(compare(candidate.loss,best.loss)<0){best=candidate;improved=true;await show(best.update)}
  }
  await yieldUi();
 }
 if(best.update.exactMatch&&!improved)converged=true;
}
let simple=best;for(const id of Object.keys(simple.update.weights).sort((a,b)=>(quality[a]??50)-(quality[b]??50))){if(simple.update.benchmarkCount<=1||!hardOpen())break;const trial={...simple.update.weights};delete trial[id];const v=run(trial,simple.update.config,"simplifying",++iteration,++tested,`Trying without ${id}`);const removed=compare(v.loss.slice(0,rankingLossLength(wanted.length)),simple.loss.slice(0,rankingLossLength(wanted.length)))<=0;if(removed)simple=v;await show({...simple.update,phase:"simplifying",iteration,tested,log:`${removed?"Removed":"Kept"} ${id}`});await yieldUi()}const done=run(simple.update.weights,simple.update.config,"complete",iteration,tested,simple.update.exactMatch?"Matched your full requested order.":"No matching configuration found. Showing the closest result.").update;await show(done);return done}
