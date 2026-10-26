export type FitPriorities = { baseline?: string[] };

/** Same pair weighting and curve as the solver's displayed fit. Rank-only scores
 * have generous margins and zero benchmark complexity. Average both directions
 * so neither person's first place is privileged. Missing models count as errors. */
export function rankingSimilarity(a: string[], b: string[]): number {
 const left = [...new Set(a)], right = [...new Set(b)];
 if (left.length < 2 || right.length < 2) return 0;
 const scores = (order: string[]) => new Map(order.map((id, i) => [id, 3 * (order.length - i)]));
 return (fitScore(left, scores(right), 0) + fitScore(right, scores(left), 0)) / 2;
}

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

/** Solver display metric. Order errors matter most, with small penalties for
 * thin score margins and extra benchmarks. Missing models count as wrong pairs. */
export function fitScore(target:string[],scores:Map<string,number>,benchCount:number){
 // Rank-weighted pair agreement mapped like Kendall's tau (a random order ≈ 0, perfect = 1), then
 // curved so getting most pairs right reads as partial credit rather than near-perfect.
 let right=0,total=0,thin=0,wSum=0;
 for(let i=0;i<target.length;i++)for(let j=i+1;j<target.length;j++){
  const a=scores.get(target[i]),b=scores.get(target[j]),w=1/Math.pow(i+1,.7);total+=w;
  if(a!=null&&b!=null&&Number.isFinite(a)&&Number.isFinite(b)&&a-b>1e-7)right+=w;
 }
 const tau=total?Math.max(0,2*right/total-1):1,wrong=100*(1-Math.pow(tau,2.5));
 // Thin margins between neighboring ranks cost a little; deep gaps are free.
 for(let i=0;i+1<target.length;i++){
  const a=scores.get(target[i]),b=scores.get(target[i+1]);
  if(a==null||b==null||!Number.isFinite(a)||!Number.isFinite(b)||a-b<=1e-7)continue;
  const w=1/(i+1);wSum+=w;thin+=w*Math.max(0,1-(a-b)/3);
 }
 const thinScore=wSum?5*thin/wSum:0,complexity=5*Math.min(1,Math.max(0,(benchCount-4)/8));
 return Math.max(0,Math.min(100,100-wrong-thinScore-complexity));
}
