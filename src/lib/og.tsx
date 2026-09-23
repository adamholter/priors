import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import type { Snapshot } from "@/data/types";
import { chartVariantMode, computeIndex, selectVariants, type IndexConfig, type RankedVariant } from "@/engine";
import { isShareDesign, type ShareDesign } from "@/lib/share-designs";
import { chartKind, chartLabel, chartTitle, type MetricChart, type MetricPoint } from "@/lib/metrics";
import QRCode from "qrcode";

type Ctx = { index: IndexConfig; who: { name: string; handle?: string; avatarUrl?: string }; top: RankedVariant[]; board: RankedVariant[]; pts: RankedVariant[]; ranked: RankedVariant[]; pareto: RankedVariant[]; benches: { id: string; name: string; share: number }[]; colors: Map<string,string>; accent: string; bg: string; date: string; qr: string; snapshot: Snapshot };
const ink="#1A1A1A", muted="#7B7B73", line="#DDDBD4", pale="#ECEAE3";
const color=(c:Ctx,x:RankedVariant)=>c.colors.get(x.model.labId)??"#A3A39B";
const effort=(_c:Ctx,x:RankedVariant)=>[x.variant.effort!=="default"?x.variant.effort:"", /without.fallback|no.fallback/i.test(x.variant.sourceModel?.name??"")?"no fallback":/fallback/i.test(x.variant.sourceModel?.name??"")?"with fallback":""].filter(Boolean).join(" · ");

const ctxCache=new Map<string,Promise<Ctx>>();
function ctxFor(snapshot:Snapshot,index:IndexConfig,who:Ctx["who"],opts?:{accent?:string;surface?:string}):Promise<Ctx>{
 // The index computation is design-independent — share it across all card variants of a config.
 const key=`${snapshot.date}|${who.name}|${who.handle??""}|${opts?.accent??""}|${opts?.surface??""}|${JSON.stringify(index)}`;
 let p=ctxCache.get(key);
 if(!p){p=(async()=>{const r=computeIndex(snapshot,{...index,variants:"all"}),mode=chartVariantMode(index,"ranking"),list=selectVariants(r.ranked,mode),pareto=selectVariants(r.ranked,chartVariantMode(index,"pareto")),link=`https://mypriors.com${who.handle?`/${who.handle}`:""}`;return{index,who,top:list.slice(0,5),board:list.slice(0,10),pts:pareto.filter(x=>!!x.costUsd&&x.costUsd>0),ranked:r.ranked,pareto,benches:r.benchmarks.map(b=>({id:b.benchmark.id,name:b.benchmark.shortName??b.benchmark.name,share:b.share})),colors:new Map(snapshot.labs.map(l=>[l.id,l.color])),accent:opts?.accent??"#2F4FB0",bg:opts?.surface??"#FBFBF9",date:snapshot.date,qr:await QRCode.toDataURL(link,{margin:0,width:300,color:{dark:"#1A1A1A",light:"#00000000"}}),snapshot}})();ctxCache.set(key,p);if(ctxCache.size>24)ctxCache.delete(ctxCache.keys().next().value!);}
 return p;
}
export async function renderShareCard(snapshot: Snapshot,index:IndexConfig,who:{name:string;handle?:string;avatarUrl?:string},opts?:{accent?:string;surface?:string;design?:string;chart?:string}) {
 const design:ShareDesign|null=isShareDesign(opts?.design)?opts.design:null;
 const [c,serif,sans,mono]=await Promise.all([ctxFor(snapshot,index,who,opts),font("Newsreader","wght@400"),font("Inter","wght@400;500;600"),font("JetBrains+Mono","wght@400;500")]);
 // An explicit design wins; then the linked chart; then a head-to-head card for
 // tiny fields (2-4 visible models); otherwise the default ranking bars.
 let body:ReactNode;
 if(!c.top.length)body=<Empty c={c}/>;
 else if(design)body=<Design c={c} design={design}/>;
 else{
  const ck=chartKind(snapshot,c.ranked,opts?.chart);
  if(ck?.kind==="cost"&&c.pts.length)body=<Constellation c={c}/>;
  else if(ck?.kind==="metric"){const pts=ck.chart.points(c.pareto);body=pts.length?<MetricCard c={c} chart={ck.chart} pts={pts} title={chartTitle(opts?.chart)??ck.chart.xName}/>:<Design c={c} design="ranking"/>;}
  else if(c.top.length<=4)body=<Matchup c={c}/>;
  else body=<Design c={c} design="ranking"/>;
 }
 return new ImageResponse(<Frame c={c}>{body}</Frame>,{width:1200,height:630,fonts:[{name:"Newsreader",data:serif},{name:"Inter",data:sans},{name:"JetBrains Mono",data:mono}]});
}
function Frame({c,children}:{c:Ctx;children:ReactNode}){return <div style={{width:1200,height:630,background:c.bg,color:ink,display:"flex",position:"relative",fontFamily:"Inter",overflow:"hidden"}}>{children}<div style={{position:"absolute",left:58,bottom:36,fontFamily:"JetBrains Mono",fontSize:15,color:muted,display:"flex"}}>{`mypriors.com · ${c.date}`}</div><div style={{position:"absolute",right:50,bottom:32,fontFamily:"Newsreader",fontSize:36,display:"flex"}}><span>pr</span><span style={{color:c.accent}}>i</span><span>ors</span></div></div>}
function Identity({c}:{c:Ctx}){return <div style={{display:"flex",alignItems:"center",gap:11}}>{c.who.avatarUrl&&<img src={c.who.avatarUrl} width="42" height="42" style={{width:42,height:42,objectFit:"cover",flexShrink:0,borderRadius:21,border:`1px solid ${line}`}} alt=""/>}<div style={{display:"flex",flexDirection:"column"}}><span style={{fontSize:18,fontWeight:500}}>{c.who.name}</span>{c.who.handle&&<span style={{fontSize:12,color:muted,fontFamily:"JetBrains Mono"}}>{`mypriors.com/${c.who.handle}`}</span>}</div></div>}
function Header({c,center=false}:{c:Ctx;center?:boolean}){return <div style={{display:"flex",flexDirection:"column",alignItems:center?"center":"flex-start"}}><Identity c={c}/><div style={{fontFamily:"Newsreader",fontSize:60,lineHeight:1.05,marginTop:21,textAlign:center?"center":"left"}}>{c.index.name}</div></div>}
function Label({c,x,size=26}:{c:Ctx;x:RankedVariant;size?:number}){return <div style={{display:"flex",flexDirection:"column",gap:5,minWidth:0}}><span style={{fontSize:size,lineHeight:1.1}}>{x.model.name}</span>{effort(c,x)&&<span style={{fontFamily:"JetBrains Mono",fontSize:Math.max(14,size-9),color:muted}}>{effort(c,x)}</span>}</div>}

function Design({c,design}:{c:Ctx;design:ShareDesign}){
 if(design==="podium"){const a=[c.top[1],c.top[0],c.top[2]].filter(Boolean);return <Base c={c} center><div style={{height:340,display:"flex",alignItems:"flex-end",justifyContent:"center",gap:9}}>{a.map(x=>{const n=c.top.indexOf(x)+1,h=n===1?285:n===2?245:215;return <div key={x.variant.id} style={{width:260,height:h,background:pale,borderTop:`8px solid ${color(c,x)}`,display:"flex",flexDirection:"column",alignItems:"center",padding:18}}><span style={{fontFamily:"Newsreader",fontSize:38}}>{n}</span><Label c={c} x={x}/><span style={{fontFamily:"JetBrains Mono",fontSize:40,marginTop:8}}>{x.score.toFixed(1)}</span></div>})}</div></Base>}
 if(design==="split")return <div style={{width:"100%",display:"flex"}}><div style={{width:445,padding:"62px 53px",borderRight:`1px solid ${line}`,display:"flex",flexDirection:"column"}}><Header c={c}/></div><Rows c={c} style={{flex:1,padding:"65px 61px"}}/></div>;
 if(design==="scoreboard")return <Base c={c}><div style={{display:"flex",flexWrap:"wrap",borderTop:`2px solid ${ink}`,borderLeft:`1px solid ${line}`}}>{c.top.map((x,i)=><div key={x.variant.id} style={{width:i<2?"50%":"33.333%",height:i<2?180:160,borderRight:`1px solid ${line}`,borderBottom:`1px solid ${line}`,padding:"14px 19px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}><span style={{fontFamily:"JetBrains Mono",color:color(c,x)}}>0{i+1}</span><Label c={c} x={x} size={25}/><span style={{fontFamily:"JetBrains Mono",fontSize:40}}>{x.score.toFixed(1)}</span></div>)}</div></Base>;
 if(design==="staircase")return <Base c={c}><div style={{display:"flex",flexDirection:"column",marginTop:20}}>{c.top.map((x,i)=><div key={x.variant.id} style={{marginLeft:i*82,width:760-i*40,height:71,borderTop:`2px solid ${color(c,x)}`,borderLeft:`1px solid ${line}`,padding:"10px 17px",display:"flex",alignItems:"center"}}><span style={{fontFamily:"Newsreader",fontSize:27,width:42}}>{i+1}</span><div style={{flex:1,display:"flex"}}><Label c={c} x={x} size={25}/></div><span style={{fontFamily:"JetBrains Mono",fontSize:28}}>{x.score.toFixed(1)}</span></div>)}</div></Base>;
 if(design==="constellation")return <Constellation c={c}/>;
 if(design==="columns"){const m=c.top[0].score||1;return <Base c={c}><div style={{height:330,display:"flex",alignItems:"flex-end",gap:14,borderBottom:`1px solid ${ink}`}}>{c.top.map((x,i)=><div key={x.variant.id} style={{width:190,height:Math.max(2,x.score/m*300),background:i?pale:ink,color:i?ink:c.bg,borderTop:`7px solid ${color(c,x)}`,padding:"15px 13px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}><span style={{fontFamily:"JetBrains Mono",fontSize:24}}>{x.score.toFixed(1)}</span><Label c={c} x={x} size={23}/></div>)}</div></Base>}
 if(design==="race"){const hi=c.top[0].score||1;return <Base c={c}><div style={{display:"flex",flexDirection:"column",gap:17,marginTop:22}}>{c.top.map((x)=><div key={x.variant.id} style={{display:"flex",alignItems:"center",height:55}}><div style={{width:310,display:"flex"}}><Label c={c} x={x} size={25}/></div><div style={{width:600,height:2,background:line,display:"flex"}}><div style={{width:`${Math.max(2,x.score/hi*100)}%`,background:color(c,x),display:"flex",justifyContent:"flex-end",alignItems:"center"}}><span style={{width:18,height:18,borderRadius:9,background:color(c,x),border:`4px solid ${c.bg}`}}/></div></div><span style={{fontFamily:"JetBrains Mono",fontSize:28,marginLeft:14}}>{x.score.toFixed(1)}</span></div>)}</div></Base>}
 if(design==="ledger")return <Base c={c}><Rows c={c} ledger/></Base>;
 if(design==="board"){const m=c.board[0]?.score||1,W=956;return <div style={{padding:"34px 58px",width:"100%",display:"flex",flexDirection:"column"}}><div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}><Identity c={c}/><div style={{fontFamily:"Newsreader",fontSize:42,lineHeight:1.05,maxWidth:640,textAlign:"right",display:"flex"}}>{c.index.name}</div></div><div style={{display:"flex",flexDirection:"column",marginTop:14,gap:3}}>{c.board.map((x,i)=>{const pct=Math.max(4,x.score/m*100),barW=W*pct/100,eff=effort(c,x),inside=barW>46+x.model.name.length*11.5+(eff?eff.length*8.5+16:0);return <div key={x.variant.id} style={{position:"relative",height:40,display:"flex",alignItems:"center"}}><div style={{position:"absolute",top:0,bottom:0,left:0,right:88,background:pale,display:"flex"}}/><div style={{position:"absolute",top:0,bottom:0,left:0,width:barW,background:color(c,x),display:"flex"}}/><span style={{position:"absolute",left:inside?14:barW+10,fontFamily:"JetBrains Mono",fontSize:15,color:inside?"#FFFFFFCC":muted,display:"flex"}}>{String(i+1).padStart(2,"0")}</span><span style={{position:"absolute",left:inside?50:barW+44,fontSize:20,lineHeight:1.05,color:inside?"#FFFFFF":ink,display:"flex"}}>{x.model.name}{eff&&<span style={{fontFamily:"JetBrains Mono",fontSize:13,color:inside?"#FFFFFFB3":muted,marginLeft:10}}>{eff}</span>}</span><span style={{position:"absolute",right:14,fontFamily:"JetBrains Mono",fontSize:21,color:ink,display:"flex"}}>{x.score.toFixed(1)}</span></div>})}</div></div>;}
 if(design==="qr"){const m=c.board[0]?.score||1,W=676;return <div style={{padding:"34px 58px",width:"100%",display:"flex"}}><div style={{flex:1,display:"flex",flexDirection:"column"}}><Identity c={c}/><div style={{fontFamily:"Newsreader",fontSize:40,lineHeight:1.05,marginTop:10,display:"flex"}}>{c.index.name}</div><div style={{display:"flex",flexDirection:"column",marginTop:14,gap:3}}>{c.board.slice(0,9).map((x,i)=>{const pct=Math.max(4,x.score/m*100),barW=W*pct/100,eff=effort(c,x),inside=barW>46+x.model.name.length*10.5+(eff?eff.length*8+16:0);return <div key={x.variant.id} style={{position:"relative",height:38,display:"flex",alignItems:"center"}}><div style={{position:"absolute",top:0,bottom:0,left:0,right:84,background:pale,display:"flex"}}/><div style={{position:"absolute",top:0,bottom:0,left:0,width:barW,background:color(c,x),display:"flex"}}/><span style={{position:"absolute",left:inside?13:barW+10,fontFamily:"JetBrains Mono",fontSize:14,color:inside?"#FFFFFFCC":muted,display:"flex"}}>{String(i+1).padStart(2,"0")}</span><span style={{position:"absolute",left:inside?44:barW+40,fontSize:18,lineHeight:1.05,color:inside?"#FFFFFF":ink,display:"flex"}}>{x.model.name}{eff&&<span style={{fontFamily:"JetBrains Mono",fontSize:12,color:inside?"#FFFFFFB3":muted,marginLeft:9}}>{eff}</span>}</span><span style={{position:"absolute",right:13,fontFamily:"JetBrains Mono",fontSize:19,color:ink,display:"flex"}}>{x.score.toFixed(1)}</span></div>})}</div></div><div style={{width:270,marginLeft:40,borderLeft:`1px solid ${line}`,paddingLeft:40,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18}}><img src={c.qr} width={196} height={196} style={{width:196,height:196}} alt=""/><span style={{fontFamily:"JetBrains Mono",fontSize:15,color:muted,display:"flex"}}>{c.who.handle?`mypriors.com/${c.who.handle}`:"mypriors.com"}</span></div></div>;}
 if(design==="spotlight"){const w=c.top[0];return <div style={{width:"100%",display:"flex"}}><div style={{width:655,background:ink,color:c.bg,padding:"56px 60px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}><Identity c={c}/><div style={{display:"flex",flexDirection:"column"}}><span style={{fontFamily:"JetBrains Mono",color:c.bg,display:"flex",alignItems:"center",gap:11}}><span style={{width:15,height:15,background:color(c,w),flexShrink:0}}/>#1 ON {c.index.name.toUpperCase()}</span><div style={{fontFamily:"Newsreader",fontSize:62,lineHeight:1.02,marginTop:15,display:"flex"}}>{w.model.name}</div>{effort(c,w)&&<span style={{fontFamily:"JetBrains Mono",color:"#BBB9B2"}}>{effort(c,w)}</span>}</div><span style={{fontFamily:"JetBrains Mono",fontSize:52}}>{w.score.toFixed(1)}</span></div><div style={{flex:1,padding:"85px 48px",display:"flex",flexDirection:"column"}}><div style={{fontFamily:"Newsreader",fontSize:32,marginBottom:24,display:"flex"}}>Also in the top five</div><Rows c={{...c,top:c.top.slice(1)}} offset={1}/></div></div>}
 return <Base c={c}><Bars c={c}/></Base>;
}
function Base({c,children,center=false}:{c:Ctx;children:ReactNode;center?:boolean}){return <div style={{padding:"44px 58px",width:"100%",display:"flex",flexDirection:"column"}}><Header c={c} center={center}/><div style={{marginTop:27,display:"flex",flexDirection:"column"}}>{children}</div></div>}
function Rows({c,style={},ledger=false,offset=0}:{c:Ctx;style?:Record<string,unknown>;ledger?:boolean;offset?:number}){return <div style={{display:"flex",flexDirection:"column",...style}}>{c.top.map((x,i)=><div key={x.variant.id} style={{height:ledger?72:83,display:"flex",alignItems:"center",borderBottom:`1px solid ${line}`}}><span style={{width:55,fontFamily:ledger?"JetBrains Mono":"Newsreader",fontSize:ledger?15:29,color:ledger?muted:ink}}>{ledger?`0${i+1+offset}`:i+1+offset}</span><div style={{flex:1,display:"flex"}}><Label c={c} x={x}/></div>{ledger&&<span style={{width:150,color:muted,fontSize:14}}>{x.model.labId}</span>}<span style={{fontFamily:"JetBrains Mono",fontSize:30,color:color(c,x)}}>{x.score.toFixed(1)}</span></div>)}</div>}
function Bars({c}:{c:Ctx}){const m=c.top[0].score||1;return <div style={{display:"flex",flexDirection:"column",gap:9}}>{c.top.map((x,i)=><div key={x.variant.id} style={{display:"flex",alignItems:"center",gap:15,minHeight:64}}><span style={{fontFamily:"JetBrains Mono",width:25,color:muted}}>{i+1}</span><div style={{width:310,display:"flex"}}><Label c={c} x={x}/></div><div style={{width:530,height:22,background:pale,display:"flex"}}><div style={{width:`${Math.max(2,x.score/m*100)}%`,background:color(c,x)}}/></div><span style={{fontFamily:"JetBrains Mono",fontSize:28,width:70,textAlign:"right"}}>{x.score.toFixed(1)}</span></div>)}</div>}
/* ---------------- shared scatter card (constellation + metric charts) ---------------- */

const niceLogTicks=(lo:number,hi:number)=>{const out:number[]=[];for(let e=Math.floor(Math.log10(lo));e<=Math.ceil(Math.log10(hi));e++)for(const m of[1,2,5]){const v=m*Math.pow(10,e);if(v>=lo&&v<=hi)out.push(v);}return out;};
const niceStep=(span:number)=>{const p=Math.pow(10,Math.floor(Math.log10(span)));for(const m of[1,2,5,10])if(m*p>=span)return m*p;return 10*p;};
const niceLinTicks=(lo:number,hi:number,n=5)=>{const step=niceStep((hi-lo)/(n-1)||1);const out:number[]=[];for(let v=Math.ceil(lo/step)*step;v<=hi+step*1e-6;v+=step)out.push(+v.toPrecision(10));return out;};
const timeTicks=(lo:number,hi:number)=>{const spanDays=(hi-lo)/864e5,stepM=spanDays>540?12:spanDays>150?3:1,out:number[]=[];const d0=new Date(lo);for(let y=d0.getUTCFullYear(),m0=0;;y++){for(let m=m0;m<12;m+=stepM){const t=Date.UTC(y,m,1);if(t>hi)return out;if(t>=lo)out.push(t);}m0=0;}};
const fmtSecs=(v:number)=>v<60?`${v%1?+v.toFixed(1):v}s`:`${(v/60)%1?+(v/60).toFixed(1):v/60} min`;
const tickMoney=(v:number)=>v<1?`$${v.toFixed(2)}`:v<100?(v%1?`$${v.toFixed(1)}`:`$${v}`):`$${Math.round(v)}`;

/** Compact header for chart cards: identity, index title 48, chart subtitle. */
function ChartHead({c,subtitle,titleSize=48}:{c:Ctx;subtitle?:string;titleSize?:number}){
 return <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
  <div style={{display:"flex",flexDirection:"column",minWidth:0}}>
   <Identity c={c}/>
   <div style={{fontFamily:"Newsreader",fontSize:titleSize,lineHeight:1.05,marginTop:14}}>{c.index.name}</div>
   {subtitle&&<div style={{fontSize:22,color:muted,marginTop:8}}>{subtitle}</div>}
  </div>
 </div>;
}

function ScatterCard({c,subtitle,pts,better,scale,formatX,xTitle,secsAxis,moneyAxis}:{c:Ctx;subtitle:string;pts:MetricPoint[];better:"lower"|"higher";scale?:"linear"|"log"|"time";formatX:(v:number)=>string;xTitle:string;secsAxis?:boolean;moneyAxis?:boolean}){
 const lower=better==="lower";
 const tx=(v:number)=>scale==="log"?Math.log10(v):v;
 const dominated=(z:MetricPoint)=>pts.some(q=>q!==z&&(lower?q.x<=z.x:q.x>=z.x)&&q.r.score>=z.r.score&&(q.x!==z.x||q.r.score>z.r.score));
 const frontier=pts.filter(z=>!dominated(z)).sort((a,b)=>b.r.score-a.r.score||a.x-b.x);
 const frontierLine=[...frontier].sort((a,b)=>a.x-b.x);
 if(!pts.length)return <div style={{padding:"36px 58px",width:"100%",display:"flex",flexDirection:"column"}}><ChartHead c={c} subtitle={subtitle}/><div style={{height:360,marginTop:30,borderLeft:`1px solid ${line}`,borderBottom:`1px solid ${line}`,display:"flex",alignItems:"center",justifyContent:"center",color:muted,fontFamily:"JetBrains Mono",fontSize:17}}>Data unavailable</div></div>;
 const xs=pts.map(z=>tx(z.x)),ys=pts.map(z=>z.r.score);
 const rawX0=Math.min(...xs),rawX1=Math.max(...xs),rawY0=Math.min(...ys),rawY1=Math.max(...ys);
 const xPad=Math.max((rawX1-rawX0)*.07,scale==="log"?.08:rawX1===rawX0?1:0),yPad=Math.max(2,(rawY1-rawY0)*.1);
 const x0=rawX0-xPad,x1=rawX1+xPad,y0=Math.max(0,rawY0-yPad),y1=Math.min(100,rawY1+yPad);
 const W=740,H=372,L=72,R=18,T=14,B=56;
 const X=(v:number)=>L+(tx(v)-x0)/(x1-x0||1)*(W-L-R),Y=(v:number)=>T+(y1-v)/(y1-y0||1)*(H-T-B);
 const xTicksRaw=scale==="log"?niceLogTicks(Math.min(...pts.map(z=>z.x)),Math.max(...pts.map(z=>z.x))):scale==="time"?timeTicks(Math.min(...pts.map(z=>z.x)),Math.max(...pts.map(z=>z.x))):niceLinTicks(Math.min(...pts.map(z=>z.x)),Math.max(...pts.map(z=>z.x)));
 const yTicks=niceLinTicks(rawY0,rawY1);
 const tickLabel=(v:number)=>moneyAxis?tickMoney(v):secsAxis?fmtSecs(v):formatX(v);
 // With only a few models, also name the best non-frontier point of each model.
 const modelCount=new Set(pts.map(z=>z.r.model.id)).size;
 const placed:{x0:number;y0:number;x1:number;y1:number}[]=[];
 const named:MetricPoint[]=[];
 if(modelCount<=4){
  const best=new Map<string,MetricPoint>();
  for(const z of pts)if(!frontier.includes(z)){const cur=best.get(z.r.model.id);if(!cur||z.r.score>cur.r.score)best.set(z.r.model.id,z);}
  for(const z of best.values()){
   const px=X(z.x),py=Y(z.r.score),w=chartLabel(z.r).length*7.6+10;
   const box={x0:px+12,y0:py-9,x1:px+12+w,y1:py+10};
   if(box.x1>W-R)continue;
   if(placed.some(b=>b.x0<box.x1&&b.x1>box.x0&&b.y0<box.y1&&b.y1>box.y0))continue;
   placed.push(box);named.push(z);
  }
 }
 return <div style={{padding:"36px 58px",width:"100%",display:"flex",flexDirection:"column"}}>
  <ChartHead c={c} subtitle={subtitle}/>
  <div style={{display:"flex",width:"100%",height:392,borderTop:`1px solid ${line}`,paddingTop:16,marginTop:14}}>
   <div style={{width:W,height:H,position:"relative",display:"flex",flexShrink:0}}>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
     {yTicks.map((v,i)=><line key={`y${i}`} x1={L} y1={Y(v)} x2={W-R} y2={Y(v)} stroke={line}/>)}
     {xTicksRaw.map((v,i)=><line key={`x${i}`} x1={X(v)} y1={T} x2={X(v)} y2={H-B} stroke={line} strokeDasharray="3 5"/>)}
     <line x1={L} y1={H-B} x2={W-R} y2={H-B} stroke={ink} strokeWidth="1.5"/><line x1={L} y1={T} x2={L} y2={H-B} stroke={ink} strokeWidth="1.5"/>
     <polyline points={frontierLine.map(z=>`${X(z.x)},${Y(z.r.score)}`).join(" ")} fill="none" stroke={ink} strokeWidth="2.5" strokeLinejoin="round"/>
     {pts.map(z=><circle key={z.r.variant.id} cx={X(z.x)} cy={Y(z.r.score)} r={frontier.includes(z)?8:4.5} fill={color(c,z.r)} stroke={frontier.includes(z)?ink:c.bg} strokeWidth={frontier.includes(z)?2.5:1.5}/>) }
    </svg>
    {yTicks.map((v,i)=><span key={`yl${i}`} style={{position:"absolute",left:0,top:Y(v)-8,width:L-12,textAlign:"right",fontFamily:"JetBrains Mono",fontSize:13,color:muted}}>{v.toFixed(0)}</span>)}
    {xTicksRaw.map((v,i)=><span key={`xl${i}`} style={{position:"absolute",left:X(v)-40,top:H-B+10,width:80,textAlign:"center",fontFamily:"JetBrains Mono",fontSize:12,color:muted}}>{tickLabel(v)}</span>)}
    {frontier.slice(0,8).map((z,i)=><span key={`label-${z.r.variant.id}`} style={{position:"absolute",left:X(z.x)-8,top:Y(z.r.score)-8,width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"JetBrains Mono",fontSize:10,lineHeight:1,color:c.bg}}>{i+1}</span>)}
    {named.map(z=><span key={`nl-${z.r.variant.id}`} style={{position:"absolute",left:X(z.x)+12,top:Y(z.r.score)-9,fontSize:13,color:ink,whiteSpace:"nowrap",display:"flex"}}>{chartLabel(z.r)}</span>)}
    <span style={{position:"absolute",left:L,top:H-21,width:W-L-R,textAlign:"center",fontSize:14}}>{xTitle}</span>
    <span style={{position:"absolute",left:-39,top:142,width:110,textAlign:"center",fontSize:14,transform:"rotate(-90deg)"}}>Score</span>
   </div>
   <div style={{width:330,height:H,marginLeft:14,paddingLeft:20,borderLeft:`1px solid ${line}`,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:8}}><span style={{fontFamily:"Newsreader",fontSize:24}}>Best tradeoffs</span><span style={{fontFamily:"JetBrains Mono",fontSize:13,color:muted}}>· {frontier.length}</span></div>
    <div style={{display:"flex",flexDirection:"column"}}>{frontier.slice(0,8).map((z,i)=><div key={z.r.variant.id} style={{display:"flex",alignItems:"center",height:40,flexShrink:0}}><span style={{width:24,height:24,borderRadius:12,background:color(c,z.r),color:c.bg,border:`1.5px solid ${ink}`,fontFamily:"JetBrains Mono",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</span><span style={{fontSize:15,lineHeight:1.15,marginLeft:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{chartLabel(z.r)}</span></div>)}</div>
   </div>
  </div>
 </div>
}

function Constellation({c}:{c:Ctx}){
 const pts:MetricPoint[]=c.pts.map(r=>({x:r.costUsd!,r}));
 return <ScatterCard c={c} subtitle="Score vs cost per task" pts={pts} better="lower" scale="log" formatX={tickMoney} xTitle="Cost per task, USD · log scale" moneyAxis/>;
}
function Empty({c}:{c:Ctx}){return <div style={{padding:68,width:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between"}}><Identity c={c}/><div style={{display:"flex",flexDirection:"column"}}><div style={{fontFamily:"Newsreader",fontSize:64,display:"flex"}}>{c.index.name}</div><div style={{fontSize:21,color:muted,marginTop:15,display:"flex"}}>No models meet this index&apos;s current requirements.</div></div><div style={{width:550,borderTop:`1px solid ${line}`,display:"flex"}}/></div>}
const cache=new Map<string,Promise<ArrayBuffer>>();
function font(family:string,axis:string){const key=family+axis;if(!cache.has(key))cache.set(key,(async()=>{const css=await(await fetch(`https://fonts.googleapis.com/css2?family=${family}:${axis}&display=swap`,{headers:{"User-Agent":""}})).text();const url=css.match(/url\(([^)]+\.ttf)\)/)?.[1]??css.match(/src: url\(([^)]+)\) format\('(truetype|opentype)'\)/)?.[1];if(!url)throw new Error(`no font url for ${family}`);return(await fetch(url)).arrayBuffer()})());return cache.get(key)!}

/** Generic metric scatter card for gallery chart links — same frame as Constellation. */
function MetricCard({c,chart,pts,title}:{c:Ctx;chart:MetricChart;pts:MetricPoint[];title:string}){
 return <ScatterCard c={c} subtitle={title} pts={pts} better={chart.better} scale={chart.scale} formatX={chart.formatX} xTitle={`${chart.xName}${chart.scale==="log"?" · log scale":""}`} secsAxis={chart.secs}/>;
}

/** Head-to-head card for indexes with only a few visible models. */
function Matchup({c}:{c:Ctx}){
 const models=c.top.slice(0,4);
 const n=models.length,lead=models[0];
 const gap=280; // left label column in the table
 const colW=(1084-gap-(n-1)*16)/n;
 const benches=[...c.benches].sort((a,b)=>b.share-a.share).slice(0,4);
 const money=(v:number)=>v<.01?`$${v.toFixed(3)}`:v<1?`$${v.toFixed(2)}`:v<100?`$${v.toFixed(v<10?1:0)}`:`$${Math.round(v)}`;
 const trunc=(s:string,m:number)=>s.length>m?`${s.slice(0,m-1)}…`:s;
 const cell=(x:RankedVariant,txt:string,best:boolean,est?:boolean)=><div key={x.variant.id} style={{width:colW,marginRight:16,display:"flex",justifyContent:"center",fontFamily:"JetBrains Mono",fontSize:20,fontWeight:best?600:400,color:est?muted:ink}}>{txt}</div>;
 const valOf=(x:RankedVariant,bid:string)=>x.values.find(v=>v.benchmarkId===bid);
 const rows:{label:string;sub:string;lower?:boolean;vals:(x:RankedVariant)=>{txt:string;num?:number;est?:boolean}}[]=[
  ...benches.map(b=>({label:b.name,sub:`${Math.round(b.share)}%`,vals:(x:RankedVariant)=>{const v=valOf(x,b.id);return v?{txt:v.value.toFixed(1),num:v.value,est:v.estimated}:{txt:"–"};}})),
 ];
 if(models.some(x=>x.costUsd!=null))rows.push({label:"Cost per task",sub:"measured",lower:true,vals:(x)=>x.costUsd!=null?{txt:money(x.costUsd),num:x.costUsd}:{txt:"–"}});
 if(models.some(x=>x.speed!=null))rows.push({label:"Output speed",sub:"tok/s",vals:(x)=>x.speed!=null?{txt:`${Math.round(x.speed)}`,num:x.speed}:{txt:"–"}});
 return <div style={{padding:"38px 58px",width:"100%",display:"flex",flexDirection:"column"}}>
  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:30}}>
   {c.who.name||c.who.handle?<Identity c={c}/>:null}
   <div style={{fontFamily:"Newsreader",fontSize:44,lineHeight:1.05,maxWidth:c.who.name||c.who.handle?760:1084,textAlign:c.who.name||c.who.handle?"right":"left",display:"flex"}}>{c.index.name}</div>
  </div>
  <div style={{display:"flex",marginTop:22,marginLeft:gap}}>
   {models.map((x,i)=><div key={x.variant.id} style={{width:colW,marginRight:16,borderTop:`7px solid ${color(c,x)}`,paddingTop:12,display:"flex",flexDirection:"column"}}>
    <span style={{fontFamily:"JetBrains Mono",fontSize:15,color:muted}}>#{x.rank}{i>0?`  −${(lead.score-x.score).toFixed(1)}`:""}</span>
    <span style={{fontFamily:"Newsreader",fontSize:26,lineHeight:1.1,marginTop:5,height:57,overflow:"hidden"}}>{trunc(chartLabel(x),40)}</span>
    <span style={{fontFamily:"JetBrains Mono",fontSize:48,marginTop:4}}>{x.score.toFixed(1)}</span>
   </div>)}
  </div>
  <div style={{display:"flex",flexDirection:"column",marginTop:22,borderTop:`1px solid ${line}`}}>
   {rows.map((row,i)=>{
    const vs=models.map(row.vals),nums=vs.map(v=>v.num).filter((v):v is number=>v!=null),best=row.lower?Math.min(...nums):Math.max(...nums);
    return <div key={i} style={{display:"flex",alignItems:"center",height:36,borderBottom:`1px solid ${line}`}}>
     <div style={{width:gap-20,display:"flex",alignItems:"baseline",gap:10,minWidth:0}}><span style={{fontSize:18,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.label}</span><span style={{fontFamily:"JetBrains Mono",fontSize:13,color:muted,flexShrink:0}}>{row.sub}</span></div>
     {models.map((x,j)=>cell(x,vs[j].txt,vs[j].num===best&&vs.length>1,vs[j].est))}
    </div>;
   })}
  </div>
 </div>
}
