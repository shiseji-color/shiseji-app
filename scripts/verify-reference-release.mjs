import { chromium } from 'file:///C:/Users/StoreTest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COLOR_IDENTITY_OPTIONS, applyIdentityKnowledge } from '../lib/color-framework.js';
import { observationsForTarget } from './evaluate-color-framework.js';
const profileCode = process.env.REPORT_REVIEW_PROFILE;
const profile = profileCode ? COLOR_IDENTITY_OPTIONS.find(p => p.code === profileCode) : null;
if (profileCode && !profile) throw Error('Unknown review profile');
const base = process.env.REPORT_REVIEW_URL || 'http://127.0.0.1:4175/?preview=1&reference=warm-spring';
const url = new URL(base);
if (!(url.hostname === '127.0.0.1' || (url.hostname === 'staging.shiseji.com' && url.searchParams.get('qa') === 'report'))) throw Error('Review host guard');
const out = path.resolve('artifacts/reference-release', url.hostname === 'staging.shiseji.com' ? 'staging' : '.', profileCode || '.');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
const findings = [];
for (const [width,height] of [[390,844],[1440,900]]) {
 const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:1,acceptDownloads:true,
  userAgent:width===390?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1':undefined});
 const errors=[], requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+new URL(r.url()).pathname)});
 page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))requests.push(new URL(r.url()).pathname)});
 await page.goto(base);
 await page.waitForFunction(()=>document.body.dataset.referenceReview==='ready');
 if(profile){
  const fixture=applyIdentityKnowledge({dimension_data:observationsForTarget(profile.target)});
  await page.evaluate(fixture=>{
   const result={...window.currentAnalysisResult,...fixture,description:'合成观察演示，不是对示例人物的真实分析。',color_impression:(fixture.style_keywords||[]).join('、')+'。让颜色衬托你，而不是盖过你。'};
   result.identity_assessment.message='合成数据演示：分型由固定规则计算，不代表真人识别准确率。';
   renderAIResult(result);
  },fixture);
 }
 await page.evaluate(()=>{const original=deliverGeneratedFiles;window.qaFiles=[];deliverGeneratedFiles=(files,options)=>{window.qaFiles=files;return original(files,options)}});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.reference-figure img')].map(i=>i.decode()));closeCustomAlert();document.querySelector('#toastContainer')?.replaceChildren()});
 await page.waitForTimeout(1200);
 const audit=await page.evaluate(()=>({
  title:document.querySelector('#res-season-name').textContent,
  status:window.currentStyleReferences.status,
  photoWidth:document.querySelector('#userAvatarResult').getBoundingClientRect().width,
  overflow:document.documentElement.scrollWidth>innerWidth+1,
  images:[...document.querySelectorAll('.reference-figure img')].map(i=>({width:i.naturalWidth,height:i.naturalHeight,renderWidth:i.width,renderHeight:i.height})),
  font:getComputedStyle(document.querySelector('.archive-title')).fontFamily,
  reportFontLoaded:document.fonts.check('400 24px "Shiseji Report Serif"','杏光柔暖')
 }));
 await page.screenshot({path:path.join(out,'report-'+width+'.png'),fullPage:true});
 await page.screenshot({path:path.join(out,'cover-'+width+'.jpg'),type:'jpeg',quality:70});
 await page.locator('a[href="#report-beauty"]').first().click();
 await page.waitForTimeout(600);
 await page.screenshot({path:path.join(out,'beauty-'+width+'.jpg'),type:'jpeg',quality:70});
 await page.locator('#xhsSaveBtn').click();
 await page.waitForFunction(()=>!reportExportInProgress);
 const album=await page.evaluate(()=>({count:window.qaFiles.length,alert:window.qaFiles.length?null:document.getElementById('alertMessage').textContent}));
 if(album.count===6){
  const sources=await page.evaluate(()=>Promise.all(window.qaFiles.map(b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)}))));
  for(let i=0;i<sources.length;i++){
   const data=sources[i];
   if(width===390)await writeFile(path.join(out,'album-'+(i+1)+'.png'),Buffer.from(data.split(',')[1],'base64'));
  }
 }
 await page.evaluate(()=>{closeSaveOverlay();closeCustomAlert();window.qaFiles=[]});
 await page.evaluate(()=>saveAsImage());
 const long=await page.evaluate(async()=>{
  const file=window.qaFiles[0];
  const buffer=file?await file.arrayBuffer():null;
  const view=buffer?new DataView(buffer):null;
  return {visible:window.qaFiles.length===1,src:file?URL.createObjectURL(file):null,width:view?.getUint32(16),height:view?.getUint32(20),alert:document.getElementById('alertMessage').textContent};
 });
 if(long.visible&&long.src&&width===390){
  const data=await page.evaluate(()=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(window.qaFiles[0])}));
  await writeFile(path.join(out,'report-long.png'),Buffer.from(data.split(',')[1],'base64'));
 }
 findings.push({width,height,...audit,album,long:{visible:long.visible,width:long.width,height:long.height,alert:long.visible?null:long.alert},errors,apiRequests:requests});
 await page.close();
}
await browser.close();
await writeFile(path.join(out,'verification.json'),JSON.stringify(findings,null,2));
console.log(JSON.stringify(findings,null,2));
if(findings.some(f=>f.overflow||f.errors.length||f.apiRequests.length||!f.reportFontLoaded||f.album.count!==6||!f.long.visible||f.long.height>16384||f.long.width>16384||f.photoWidth>140))process.exitCode=1;
