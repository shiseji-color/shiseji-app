import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('album asset wait times out and clears its timer', async () => {
 const album=readFileSync(new URL('../web/reference-album.js',import.meta.url),'utf8');
 const helper=album.slice(album.indexOf(' async function waitForAsset'),album.indexOf(' function palette'));
 let expire;
 let cleared=0;
 const wait=runInNewContext(helper+';waitForAsset',{
  setTimeout(callback,delay){assert.equal(delay,15000);expire=callback;return 7;},
  clearTimeout(id){assert.equal(id,7);cleared++;}
 });
 assert.equal(await wait(Promise.resolve('ready')),'ready');
 assert.equal(cleared,1);
 const stuck=wait(new Promise(()=>{}));
 expire();
 await assert.rejects(stuck,/asset timeout/);
 assert.equal(cleared,2);
 await assert.rejects(wait(Promise.reject(Error('decode failed'))),/decode failed/);
 assert.equal(cleared,3);
});

test('preview soft charcoal brown matches the existing SSJ-02 definition', () => {
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const framework=readFileSync(new URL('../lib/color-framework.js',import.meta.url),'utf8');
 const profile=framework.split('\n').find(line=>line.includes("profile('SSJ-02'"));
 const canonical=profile.match(/\['柔炭棕','(#[0-9A-Fa-f]{6})'\]/)[1];
 const preview=app.match(/name: '柔炭棕', hex: '(#[0-9A-Fa-f]{6})'/)[1];
 assert.equal(preview,canonical);
 assert.notEqual(preview,'#7C707B');
});

test('reference long export removes native disclosure widgets only in its clone', () => {
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/cloneArea\.classList\.contains\('reference-reading'\)/);
 assert.match(app,/cloneArea\.classList\.add\('reference-long-export'\)/);
 assert.match(app,/cloneArea\.querySelectorAll\('details'\)\.forEach\(\(details\) => details\.remove\(\)\)/);
 assert.match(app,/专业色彩依据与 16 维观察请回到网页查看/);
 const css=readFileSync(new URL('../web/reference-preview.css',import.meta.url),'utf8');
 assert.match(css,/\.reference-reading\.reference-long-export \.archive-section\{padding-block:1\.6rem\}/);
});

test('album closing keeps complete Chinese words and tips come from the report', () => {
 const album=readFileSync(new URL('../web/reference-album.js',import.meta.url),'utf8');
 assert.match(album,/都更接近喜欢的自己。/);
 assert.doesNotMatch(album,/shortTips|warm-spring|SSJ-02|柔光暖春|location\.hostname/);
 assert.match(album,/row\.querySelector\('dd'\)/);
 assert.match(album,/#res-makeup-recipe/);
 assert.match(album,/#res-outfit-formula/);
 const css=readFileSync(new URL('../web/reference-preview.css',import.meta.url),'utf8');
 assert.match(css,/\.album-closing span\{display:block;white-space:nowrap\}/);
});

test('album carries the report color cues into beauty and outfit pages', () => {
 const album=readFileSync(new URL('../web/reference-album.js',import.meta.url),'utf8');
 assert.match(album,/source\.querySelector\('\.reference-color-cues'\)/);
 assert.match(album,/cues\.cloneNode\(true\)/);
 assert.match(album,/\+' · '\+index\+' \/ 6/);
});

test('color cue dots keep an explicit optical baseline in album and long exports', () => {
 const css=readFileSync(new URL('../web/reference-preview.css',import.meta.url),'utf8');
 assert.match(css,/\.reference-color-cue\{display:inline-grid;grid-template-columns:11px max-content/);
 assert.match(css,/\.reference-color-cue i\{[^}]*margin-top:3px/);
 assert.match(css,/\.reference-album-page \.reference-color-cue i\{[^}]*margin-top:4px/);
 assert.match(css,/\.reference-reading\.reference-long-export \.reference-color-cue b\{overflow:visible;text-overflow:clip\}/);
});

test('album guidance points to recommended colors and does not assume the main color is lightest', () => {
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(html,/把本命色留在手边/);
 assert.doesNotMatch(html,/喜欢这些颜色也无需舍弃/);
 assert.match(app,/以主色建立大面积秩序/);
 assert.doesNotMatch(app,/以最浅色建立大面积呼吸感/);
});

class AlbumNode {
 constructor(tag='div',value=''){this.tagName=tag;this.textContent=value;this.children=[];this.style={};this.dataset={};this.className='';this.classList={add:name=>{this.className+=' '+name;}};this.selectors={};}
 append(...nodes){for(const child of nodes){this.children.push(child);child.parentElement=this;}}
 querySelector(selector){return this.selectors[selector]||null;}
 querySelectorAll(selector){return this.selectors[selector]||[];}
}
function composeFixture(){
 const values={
  '#res-season-name':'冷澈冬影','#res-identity-code':'COLOR ID · SSJ-15',
  '#res-season-en':'COOL WINTER','#res-color-impression':'冷而清晰',
  '#res-desc':'这是当前报告描述','#res-identity-assessment':'照片条件下的观察',
  '#res-makeup-recipe':'冷莓唇色与灰棕眼妆','#res-outfit-formula':'深蓝上装搭配灰色长裤',
  '#res-accessory':'银色饰品','#report-palette .archive-copy':'当前报告色卡说明'
 };
 const colors=Array.from({length:8},(_,i)=>({name:'色'+i,hex:'#'+String(i+1).repeat(6)}));
 const swatches=colors.map(color=>{const n=new AlbumNode();n.selectors.b=new AlbumNode('b',color.name);n.selectors.span=new AlbumNode('span',color.hex);return n;});
 const sections={};
 for(const kind of ['beauty','outfit']){const n=new AlbumNode();n.selectors.h2=new AlbumNode('h2',kind==='beauty'?'妆容参考':'穿搭参考');n.selectors['.archive-copy']=new AlbumNode('p','当前说明');n.selectors['.reference-why']=new AlbumNode('p',kind==='beauty'?'妆容补充说明':'穿搭补充说明');n.selectors['.reference-ending']=new AlbumNode('p',kind==='beauty'?'先试一种唇色':'先从已有上衣开始');sections['report-'+kind]=n;}
 const context={window:{reportColorStylingSchemes:Array.from({length:3},(_,i)=>({title:'场景'+i,colors:colors.slice(0,3),ratios:[50,30,20],copy:'来自当前方案的文字'+i}))},
 document:{createElement:tag=>new AlbumNode(tag),querySelector:selector=>values[selector]?new AlbumNode('p',values[selector]):null,querySelectorAll:selector=>selector==='#res-best-colors .palette-swatch'?swatches:[],getElementById:id=>sections[id]}};
 const code=readFileSync(new URL('../web/reference-album.js',import.meta.url),'utf8').replace(' window.generateReferenceAlbum=async button=>{',' window.composeForTest=compose; window.generateReferenceAlbum=async button=>{');
 runInNewContext(code,context);
 return context.window.composeForTest();
}
function flatten(node){return [node.textContent,...node.children.map(flatten)].join('\n');}
test('six-page composition supports another profile and missing optional reference DOM',()=>{
 const pages=composeFixture();
 assert.equal(pages.length,6);
 const all=pages.map(flatten).join('\n');
 assert.match(all,/冷澈冬影/);assert.match(all,/SSJ-15/);
 assert.match(all,/冷莓唇色与灰棕眼妆/);assert.match(all,/深蓝上装搭配灰色长裤/);
 assert.match(all,/妆容补充说明/);assert.match(all,/穿搭补充说明/);
 assert.match(all,/先试一种唇色/);assert.match(all,/先从已有上衣开始/);
 assert.match(all,/来自当前方案的文字2/);
 assert.equal((all.match(/本类型风格示例图暂未提供/g)||[]).length,2);
 assert.doesNotMatch(all,/柔光暖春|SSJ-02|暖浅色|金色饰品/);
 assert.equal((all.match(/非本人试妆或试穿效果/g)||[]).length,6);
});
test('album guard rejects vertical, horizontal and descendant clipping',()=>{
 const code=readFileSync(new URL('../web/reference-album.js',import.meta.url),'utf8');
 const helper=code.slice(code.indexOf(' function assertPageFits'),code.indexOf(' window.generateReferenceAlbum'));
 const check=runInNewContext(helper+';assertPageFits');
 const box={left:0,right:400,bottom:500};
 const footerBox={left:0,right:400,bottom:700};
 const content={scrollHeight:500,clientHeight:500,scrollWidth:400,clientWidth:400,getBoundingClientRect:()=>box,querySelectorAll:()=>[]};
 const footer={getBoundingClientRect:()=>footerBox};
 const card={scrollHeight:720,clientHeight:720,scrollWidth:540,clientWidth:540,getBoundingClientRect:()=>({left:0,right:540,bottom:720}),querySelector:selector=>selector==='.album-footer'?footer:content};
 assert.doesNotThrow(()=>check(card));
 content.scrollHeight=502;assert.throws(()=>check(card),/page overflow/);content.scrollHeight=500;
 content.scrollWidth=402;assert.throws(()=>check(card),/page overflow/);content.scrollWidth=400;
 content.querySelectorAll=()=>[{getBoundingClientRect:()=>({left:0,right:400,bottom:510,width:400,height:20})}];
 assert.throws(()=>check(card),/page overflow/);
 content.querySelectorAll=()=>[];
 footer.getBoundingClientRect=()=>({left:0,right:400,bottom:722});
 assert.throws(()=>check(card),/page overflow/);
});
