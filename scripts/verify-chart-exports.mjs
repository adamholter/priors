import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
const out='/tmp/priors-chart-qa'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1100}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:48740',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'General frontier',exact:true}).waitFor();
const config=new URL(page.url()).searchParams.get('i');
assert.equal(config,'General%20frontier|deepswe-1.1:43,terminalbench-4:54,arc-agi-3:9,simplebench:38,bsbench-v2:12,aa-humanitys-last-exam:37,aa-omniscience:24,frontiermath-tier-4-v2:42|opt=deepswe-1.1|strict=20|cut=20|var=best');
const chart=page.getByRole('img',{name:'Index score versus cost per task',exact:true});
assert.equal(await chart.locator('canvas').count(),0);assert.equal(await chart.locator('svg').count(),1);
assert(await chart.locator('svg text').count()>10);
for(const name of ['Rankings','Pareto frontier'])for(const format of ['SVG','PNG']){
const promise=page.waitForEvent('download');await page.getByRole('button',{name:`Download ${name} ${format}`,exact:true}).click();
const d=await promise;const path=`${out}/${d.suggestedFilename()}`;await d.saveAs(path);
const b=await readFile(path);if(format==='PNG'){assert.equal(b.toString('ascii',1,4),'PNG');assert(b.readUInt32BE(16)>2000);}else {assert(b.toString().includes('<svg'));assert(b.toString().includes('<text'));}
}
await chart.screenshot({path:`${out}/pareto.png`});
await page.evaluate(()=>document.body.style.zoom='2');await chart.screenshot({path:`${out}/pareto-zoom.png`});
await page.evaluate(()=>document.body.style.zoom='1');
await page.setViewportSize({width:390,height:844});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.getByRole('group',{name:'Export Pareto frontier',exact:true}).screenshot({path:`${out}/mobile-export.png`});
assert.deepEqual(errors,[]);console.log('PASS exact default URL, SVG chart, PNG/SVG downloads, 200% zoom, mobile.');
}finally{await browser.close();}
