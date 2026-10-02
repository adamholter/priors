/** Standalone, interactive HTML exports: ECharts from a pinned CDN build plus the chart's data baked in. */

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
  points: { v: [number, number]; c: string; d?: string; n: string; s: boolean; f: boolean; t: string }[];
  frontier: [number, number][]; links: { c: string; d?: string; p: [number, number][] }[];
};

export function scatterHtml(spec: ScatterSpec) {
  return page(spec.title, spec.date ?? "", `const S=${json(spec)};
const fmt=compact(S.unit);
chart.setOption({textStyle:{fontFamily:"Inter,system-ui,sans-serif",color:P.ink},grid:{left:48,right:130,top:30,bottom:44,...CONTAIN},tooltip:{...tip,trigger:"item",formatter:(p)=>p.data&&p.data.t||""},
xAxis:{...axis,type:S.scale==="linear"?"value":S.scale,scale:S.scale==="linear",name:S.xName,nameLocation:"end",nameGap:8,nameTextStyle:{color:GREY,fontSize:11,align:"right",verticalAlign:"top",padding:[26,0,0,0]},axisLabel:{...axis.axisLabel,hideOverlap:true,showMinLabel:S.scale==="linear",showMaxLabel:S.scale==="linear",...(S.scale==="time"?{}:{formatter:fmt})},...(S.scale==="log"?{min:(e)=>e.min/1.5,max:(e)=>e.max*1.8}:{})},
yAxis:{...axis,type:"value",name:"Index score",min:S.yMin,max:S.yMax,nameTextStyle:{color:GREY,fontSize:11,align:"left",padding:[0,0,0,-30]}},
series:[...S.links.map((l)=>({type:"line",data:l.p,showSymbol:false,silent:true,lineStyle:{color:lab(l),width:1,opacity:D?.45:.35},z:1})),
...(S.frontier.length>1?[{type:"line",data:S.frontier,showSymbol:false,silent:true,lineStyle:{color:P.ink,width:1.4},z:2}]:[]),
{type:"scatter",z:3,data:S.points.map((p)=>({value:p.v,name:p.n,t:p.t,symbolSize:p.f?11:9,itemStyle:{color:lab(p),borderColor:p.f?P.ink:P.bg,borderWidth:1.5},label:{show:p.s}})),
label:{position:"right",formatter:"{b}",fontSize:11.5,color:P.ink,distance:7,backgroundColor:P.labelBg,padding:[2,3],borderRadius:2},labelLayout:inside,emphasis:{scale:1.4,label:{show:true,fontWeight:600}}}]},true);`, 520);
}

export type BarSpec = { title: string; date?: string; yName: string; unit: { prefix: string; suffix: string }; bars: { n: string; v: number; c: string; d?: string; t: string }[] };

export function barsHtml(spec: BarSpec) {
  return page(spec.title, spec.date ?? "", `const S=${json(spec)};
const fmt=compact(S.unit);
chart.setOption({textStyle:{fontFamily:"Inter,system-ui,sans-serif",color:P.ink},grid:{left:52,right:16,top:34,bottom:100,...CONTAIN},tooltip:{...tip,trigger:"item",formatter:(p)=>S.bars[p.dataIndex].t},
xAxis:{...axis,type:"category",data:S.bars.map((b)=>b.n),axisLabel:{...axis.axisLabel,fontFamily:"Inter,system-ui,sans-serif",color:P.ink2,rotate:45,interval:0,fontSize:10.5,width:110,overflow:"truncate"}},
yAxis:{...axis,type:"value",name:S.yName,nameTextStyle:{color:GREY,fontSize:11,align:"left",padding:[0,0,0,-30]},axisLabel:{...axis.axisLabel,formatter:fmt}},
series:[{type:"bar",barMaxWidth:28,data:S.bars.map((b)=>({value:b.v,itemStyle:{color:lab(b),borderRadius:[2,2,0,0]}})),label:{show:true,position:"top",fontSize:10,fontFamily:MONO,color:P.ink,formatter:(p)=>fmt(p.value)}}]},true);`, 460);
}
