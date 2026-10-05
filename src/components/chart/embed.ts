/** Standalone, interactive HTML exports: ECharts from a pinned CDN build plus the chart's data baked in. */
import { scatterLabelLayout } from "./scatter-label-layout";

const ECHARTS = "https://cdn.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/** Axis formatting that survives serialization: a unit prefix/suffix read off the app's own formatter. */
export function unitOf(format: (x: number) => string) {
  const sample = format(1);
  return { prefix: sample.startsWith("$") ? "$" : "", suffix: sample.replace(/^[$]?[\d.,]+/, "").replace(/^k(?=\s|$)/, "") };
}

/** Both schemes ship in every export; the embed follows the viewer's color scheme (or `?theme=light|dark`, or
 *  `#dark` / `#light` on the URL) and re-renders when it changes. Lab colors carry a dark variant per mark. */
const SCHEMES = {
  light: { bg: "#FBFBF9", ink: "#1A1A1A", ink2: "#595B53", grey: "#8A8A80", hair: "#ECEAE3", tipBg: "#FFFFFF", tipBorder: "#DDDBD4", link: "#2F4FB0", labelBg: "rgba(251,251,249,.72)" },
  dark: { bg: "#141413", ink: "#EDECE6", ink2: "#C2C1B9", grey: "#8C8B83", hair: "#262624", tipBg: "#1F1F1C", tipBorder: "#3A3A35", link: "#9AABF5", labelBg: "rgba(20,20,19,.72)" },
};

function page(title: string, date: string, script: string, height: number) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>${esc(title)} · Priors</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=JetBrains+Mono&family=Newsreader:opsz@6..72&display=swap" rel="stylesheet">
<style>html,body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:28px 24px 20px}h1{font:400 26px/1.1 Newsreader,Georgia,serif;letter-spacing:-.02em;margin:0 0 12px}#c{width:100%;height:${height}px}footer{font:11px 'JetBrains Mono',monospace;color:var(--grey);margin-top:10px}footer a{color:var(--link);text-decoration:none}</style>
</head><body><main><h1>${esc(title)}</h1><div id="c" role="img" aria-label="${esc(title)}"></div><footer><a href="https://mypriors.com">mypriors.com</a>${date ? ` · ${esc(date)}` : ""}</footer></main>
<script src="${ECHARTS}"></script><script>
const MONO="'JetBrains Mono',Menlo,monospace",SCHEMES=${json(SCHEMES)};
// Keep axis labels inside the canvas, and flip point labels inward at the right edge (same rules as the site).
const CONTAIN={outerBounds:{left:10,right:4,top:2,bottom:4},outerBoundsContain:"all"};
const inside=(p)=>{const w=chart.getWidth(),r=p.labelRect,o={hideOverlap:true,moveOverlap:"shiftY"};if(r.x+r.width>w-4){o.x=p.rect.x-6;o.align="right"}if(r.y<2)o.y=2+r.height/2;return o};
const compact=(u)=>(v)=>{const a=Math.abs(v);const n=a>=1000?(+(v/1000).toFixed(a>=10000?0:1))+"k":a>=100?Math.round(v)+"":a>=10?v.toFixed(1):(+v.toPrecision(2))+"";return u.prefix+n+u.suffix};
const forced=(new URLSearchParams(location.search).get("theme")||location.hash.slice(1)).toLowerCase();
const mq=matchMedia("(prefers-color-scheme: dark)");
const isDark=()=>forced==="dark"||(forced!=="light"&&mq.matches);
const chart=echarts.init(document.getElementById("c"),null,{renderer:"svg"});
let onFinish=()=>{};
chart.on("finished",()=>onFinish());
function render(){
const D=isDark(),P=SCHEMES[D?"dark":"light"],GREY=P.grey,lab=(o)=>D&&o.d?o.d:o.c;
for(const k of ["bg","ink","grey","link"])document.documentElement.style.setProperty("--"+k,P[k]);
document.documentElement.style.colorScheme=D?"dark":"light";
const axis={axisLine:{show:false},axisTick:{show:false},splitLine:{lineStyle:{color:P.hair}},axisLabel:{color:GREY,fontFamily:MONO,fontSize:11}};
const tip={confine:true,backgroundColor:P.tipBg,borderColor:P.tipBorder,borderWidth:1,textStyle:{color:P.ink,fontSize:12},extraCssText:"box-shadow:none;border-radius:4px;padding:8px 10px"};
${script}
}
render();
mq.addEventListener("change",render);
addEventListener("resize",()=>chart.resize());
</script></body></html>`;
}

export type ScatterSpec = {
  title: string; date?: string; xName: string; scale: "linear" | "log" | "time"; unit: { prefix: string; suffix: string }; yMin: number; yMax: number;
  highlight: string[]; guides: boolean;
  points: { v: [number, number]; c: string; d: string; dc: string; dd: string; m: string; id: string; e: string; h: boolean; a: boolean; g: boolean; gx?: string; n: string; s: boolean; f: boolean; t: string }[];
  frontier: [number, number][]; links: { m: string; h: boolean; c: string; d: string; dc: string; dd: string; p: [number, number][] }[];
};

export function scatterHtml(spec: ScatterSpec) {
  return page(spec.title, spec.date ?? "", `const S=${json(spec)};
const fmt=compact(S.unit);
const active=S.highlight.length>0,dim=(o)=>D?o.dd:o.dc;
const guides=()=>{
const grid=chart.getModel().getComponent("grid",0)?.coordinateSystem?.getRect();if(!grid)return;
const bottom=grid.y+grid.height,on=D?"#141413":"#FFFFFF";
const badge={fontSize:10.5,fontFamily:MONO,fill:on,padding:[2,4],borderRadius:2};
const placed=S.guides?S.points.filter((p)=>p.g).slice(0,8).map((p)=>({p,px:chart.convertToPixel({seriesId:"marks"},p.v)})).filter((g)=>g.px&&Number.isFinite(g.px[0])&&Number.isFinite(g.px[1])):[];
const W=chart.getWidth(),xs=placed.map(({p,px})=>{const text=p.gx||fmt(p.v[0]);return{text,at:px[0],size:text.length*6.6+10}}),ys=placed.map(({p,px})=>({text:p.v[1].toFixed(1),at:px[1],size:16}));
const spread=(items,lo,hi)=>{const order=items.map((_,i)=>i).sort((i,j)=>items[i].at-items[j].at),pos=items.map((it)=>it.at);for(let k=0;k<order.length;k++){const i=order[k],prev=order[k-1];pos[i]=Math.max(pos[i],lo+items[i].size/2,prev==null?-Infinity:pos[prev]+(items[prev].size+items[i].size)/2+3)}for(let k=order.length-1;k>=0;k--){const i=order[k],next=order[k+1];pos[i]=Math.min(pos[i],hi-items[i].size/2,next==null?Infinity:pos[next]-(items[next].size+items[i].size)/2-3)}return pos};
const xAt=spread(xs,2,W-2),yAt=spread(ys,grid.y-6,bottom+6);
const children=placed.flatMap(({p,px},i)=>{const col=lab(p),dash={stroke:col,lineDash:[4,3],lineWidth:1.2,opacity:.9};return[
{type:"line",shape:{x1:px[0],y1:px[1],x2:px[0],y2:bottom},style:dash,z:3},
{type:"line",shape:{x1:grid.x,y1:px[1],x2:px[0],y2:px[1]},style:dash,z:3},
{type:"text",x:xAt[i],y:bottom+5,style:{...badge,text:xs[i].text,backgroundColor:col,align:"center",verticalAlign:"top"},z:20},
{type:"text",x:grid.x-5,y:yAt[i],style:{...badge,text:ys[i].text,backgroundColor:col,align:"right",verticalAlign:"middle"},z:20}
]});
const key=JSON.stringify(children);if(key===last)return;last=key;chart.setOption({graphic:[{id:"guides",type:"group",silent:true,z:3,children}]},{replaceMerge:["graphic"]});
};
let last="";onFinish=guides;
const order=[...S.points].sort((a,b)=>Number(a.h)-Number(b.h));
const scatterLabels=(${scatterLabelLayout.toString()})(()=>chart.getWidth(),()=>chart.getHeight(),order.map(p=>active?(p.a||(p.h&&p.e!=="default")):p.s));
chart.setOption({textStyle:{fontFamily:"Inter,system-ui,sans-serif",color:P.ink},grid:{left:48,right:130,top:30,bottom:44,...CONTAIN},tooltip:{...tip,trigger:"item",formatter:(p)=>p.data&&p.data.t||""},
xAxis:{...axis,type:S.scale==="linear"?"value":S.scale,scale:S.scale==="linear",name:S.xName,nameLocation:"end",nameGap:8,nameTextStyle:{color:GREY,fontSize:11,align:"right",verticalAlign:"top",padding:[26,0,0,0]},axisLabel:{...axis.axisLabel,hideOverlap:true,showMinLabel:S.scale==="linear",showMaxLabel:S.scale==="linear",...(S.scale==="time"?{}:{formatter:fmt})},...(S.scale==="log"?{min:(e)=>e.min/1.5,max:(e)=>e.max*1.8}:{})},
yAxis:{...axis,type:"value",name:"Index score",min:S.yMin,max:S.yMax,nameTextStyle:{color:GREY,fontSize:11,align:"left",padding:[0,0,0,-30]}},
series:[...S.links.map((l)=>({type:"line",data:l.p,showSymbol:false,silent:true,lineStyle:{color:active&&!l.h?dim(l):lab(l),width:l.h?2:1,opacity:l.h?1:active ? .25 : D ? .45 : .35},z:l.h?4:1})),
...(S.frontier.length>1?[{type:"line",data:S.frontier,showSymbol:false,silent:true,lineStyle:{color:P.ink,width:1.4,opacity:active ? .3 : 1},z:2}]:[]),
{type:"scatter",id:"marks",z:5,data:order.map((p)=>({value:p.v,name:p.n,id:p.id,t:p.t,symbolSize:active?(p.a?12:9):(p.f?11:9),itemStyle:{color:active&&!p.h?dim(p):lab(p),borderColor:active?(p.h?P.ink:P.bg):(p.f?P.ink:P.bg),borderWidth:active?(p.h?(p.a?1.8:1.2):1):(p.f?1.5:1.5),opacity:active&&!p.h?(D ? .55 : .6):(active||p.s||p.f?1:.8)},label:active?(p.a?{show:true,formatter:p.n,fontWeight:600,color:P.ink}:{show:p.h&&p.e!=="default",formatter:p.e.toUpperCase(),fontSize:9,color:P.grey,backgroundColor:"transparent",textBorderColor:P.bg,textBorderWidth:3,distance:5}):{show:p.s}})),
label:{position:"right",formatter:"{b}",fontSize:11.5,color:P.ink,distance:7,backgroundColor:P.labelBg,padding:[2,3],borderRadius:2},labelLayout:scatterLabels,emphasis:{scale:1.4,label:{show:true,fontWeight:600}}}]},true);
guides();`, 520);
}

export type BarSpec = { title: string; date?: string; yName: string; unit: { prefix: string; suffix: string }; highlight: string[]; bars: { n: string; v: number; c: string; d: string; dc: string; dd: string; m: string; id: string; e: string; h: boolean; a: boolean; t: string }[] };

export function barsHtml(spec: BarSpec) {
  return page(spec.title, spec.date ?? "", `const S=${json(spec)};
const fmt=compact(S.unit);
const active=S.highlight.length>0,dim=(o)=>D?o.dd:o.dc;
chart.setOption({textStyle:{fontFamily:"Inter,system-ui,sans-serif",color:P.ink},grid:{left:52,right:16,top:34,bottom:100,...CONTAIN},tooltip:{...tip,trigger:"item",formatter:(p)=>S.bars[p.dataIndex].t},
xAxis:{...axis,type:"category",data:S.bars.map((b)=>active&&b.a?{value:b.n,textStyle:{color:P.ink,fontWeight:600}}:b.n),axisLabel:{...axis.axisLabel,fontFamily:"Inter,system-ui,sans-serif",color:P.ink2,rotate:45,interval:0,fontSize:10.5,width:110,overflow:"truncate"}},
yAxis:{...axis,type:"value",name:S.yName,nameTextStyle:{color:GREY,fontSize:11,align:"left",padding:[0,0,0,-30]},axisLabel:{...axis.axisLabel,formatter:fmt}},
series:[{type:"bar",barMaxWidth:28,data:S.bars.map((b)=>({value:b.v,itemStyle:{color:active&&!b.h?dim(b):lab(b),opacity:active&&!b.h ? .6 : 1,borderRadius:[2,2,0,0]},label:active&&!b.h?{color:GREY}:active&&b.a?{fontWeight:700}:undefined})),label:{show:true,position:"top",fontSize:10,fontFamily:MONO,color:P.ink,formatter:(p)=>fmt(p.value)}}]},true);`, 460);
}
