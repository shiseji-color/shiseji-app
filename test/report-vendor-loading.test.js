import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const loader=source.slice(source.indexOf('    const reportVendorLoads'),source.indexOf('    function initRadarChart'));
test('report dependency requests deduplicate, reuse loaded globals, and retry a failed load',async()=>{
 const scripts=[];
 const context={window:{},setTimeout:()=>1,clearTimeout:()=>{},Map,Promise,Error,document:{createElement:()=>({remove(){}}),head:{append:s=>scripts.push(s)}}};
 runInNewContext(loader,context);
 const load=context.window.loadReportVendor;
 const first=load('canvas');assert.equal(first,load('canvas'));assert.equal(scripts.length,1);
 scripts[0].onerror();await assert.rejects(first,/加载失败/);
 const second=load('canvas');assert.equal(scripts.length,2);context.window.html2canvas=()=>{};scripts[1].onload();await second;
 await load('canvas');assert.equal(scripts.length,2);
 await assert.rejects(load('unknown'),/Unknown/);
});
