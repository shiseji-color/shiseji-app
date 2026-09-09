/* Current report -> six explicitly labelled summary pages. No identity-changing image generation. */
(() => {
 const node=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 const text=selector=>document.querySelector(selector)?.textContent.trim()||'';
 async function waitForAsset(promise){
  let timer;
  try{
   return await Promise.race([promise,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('asset timeout')),15000);
   })]);
  }finally{clearTimeout(timer);}
 }
 function palette(){
  return [...document.querySelectorAll('#res-best-colors .palette-swatch')].map(s=>({
   name:s.querySelector('b').textContent,hex:s.querySelector('span').textContent
  }));
 }
 function strip(colors){
  const row=node('div','album-strip');
  colors.forEach(c=>{const sw=node('i','');sw.style.background=c.hex;row.append(sw);});return row;
 }
 function page(title,index){
  const card=node('article','reference-album-page');
  card.dataset.albumPage=String(index);
  card.append(node('header','album-brand','拾 色 季'),node('h1','',title));
  const content=node('div','album-content');card.append(content);
  card.append(node('footer','album-footer',[text('#res-season-name'),text('#res-identity-code')].filter(Boolean).join(' / ')+' · '+index+' / 6\nAI 风格参考，非本人试妆或试穿效果'));
  return {card,content};
 }
 function compose(){
  const colors=palette();if(colors.length!==8)throw Error('palette not ready');
  const pages=[];
  let p=page(text('#res-season-name'),1);
  p.card.classList.add('album-identity');
  p.content.append(node('p','album-english',text('#res-season-en')),strip(colors.slice(0,4)),node('blockquote','',text('#res-color-impression')),node('p','album-copy',text('#res-desc')),node('p','album-small',text('#res-identity-assessment')));
  pages.push(p.card);
  p=page('把本命色，留在手边',2);
  p.card.classList.add('album-palette-page');
  p.content.append(node('p','album-copy',text('#report-palette .archive-copy')));
  const grid=node('div','album-palette');
  colors.forEach(c=>{const figure=node('figure','');const sw=node('div','album-color');sw.style.background=c.hex;figure.append(sw,node('figcaption','',c.name),node('small','',c.hex));grid.append(figure);});
  p.content.append(grid,node('p','album-small','屏幕与实物可能有色差，请在自然光下确认。'));pages.push(p.card);
  p=page('按场景，找到配色',3);
  p.content.append(node('p','album-copy','主色建立整体，辅助色承接层次，点睛色少量出现。比例仅作参考。'));
  const schemes=window.reportColorStylingSchemes;if(!Array.isArray(schemes)||schemes.length!==3)throw Error('schemes not ready');
  schemes.forEach(s=>{
   const row=node('section','album-scheme');row.append(node('h2','',s.title));
   const ratio=strip(s.colors);[...ratio.children].forEach((n,i)=>n.style.flex=s.ratios[i]);
   row.append(ratio,node('p','album-small',s.colors.map((c,i)=>c.name+' '+s.ratios[i]+'%').join(' · ')),node('p','album-copy',s.copy||''));
   p.content.append(row);
  });pages.push(p.card);
  ['beauty','outfit'].forEach((kind,i)=>{
   const source=document.getElementById('report-'+kind);
   if(!source)throw Error('report section unavailable');
   p=page(source.querySelector('h2')?.textContent|| (kind==='beauty'?'妆容风格参考':'穿搭风格参考'),i+4);
   p.card.classList.add('album-'+kind);
   p.content.append(node('p','album-copy',source.querySelector('.archive-copy')?.textContent||''));
   const cues=source.querySelector('.reference-color-cues');if(cues)p.content.append(cues.cloneNode(true));
   const body=node('div','album-visual');
   const figure=node('figure','');const original=source.querySelector('.reference-figure img');
   if(original?.getAttribute('src')&&!original.hidden&&!original.closest('[hidden]')){
    const image=original.cloneNode();
    image.removeAttribute('width');image.removeAttribute('height');image.removeAttribute('srcset');image.removeAttribute('sizes');image.hidden=false;
    image.style.objectFit='contain';image.style.height='auto';
    figure.append(image,node('figcaption','album-small',kind==='beauty'?'AI 虚构人物风格示例，非本人试妆效果':'AI 虚构人物搭配参考，非本人试穿效果'));
   }else{
    figure.append(strip(colors.slice(0,4)),node('p','album-copy','本类型风格示例图暂未提供'),node('p','album-small','以下保留本次报告的配色与文字建议，不使用其他类型图片替代。'));
    figure.dataset.missingReference='true';
   }
   const tips=node('div','album-tips');
   source.querySelectorAll('.reference-tips>div').forEach(row=>{
    const tip=node('section','');const dot=row.querySelector('.reference-swatch');if(dot)tip.append(dot.cloneNode());
    tip.append(node('h2','',row.querySelector('dt')?.textContent||''),node('p','album-copy',row.querySelector('dd')?.textContent||''));tips.append(tip);
   });
   if(!tips.children.length){
    tips.append(node('h2','',kind==='beauty'?'妆容方向':'搭配方向'),node('p','album-copy',text(kind==='beauty'?'#res-makeup-recipe':'#res-outfit-formula')||'请回到报告查看当前建议。'));
    if(kind==='outfit')tips.append(node('p','album-small',text('#res-accessory')));
   }
   const why=source.querySelector('.reference-why')?.textContent?.trim();
   const uncertainty=source.querySelector('.reference-uncertainty')?.textContent?.trim();
   if(uncertainty)tips.append(node('p','album-guidance-note',uncertainty));
   if(why)tips.append(node('p','album-guidance-note',why));
   const ending=source.querySelector('.reference-ending')?.textContent;
   if(ending)tips.append(node('p','album-guidance-ending',ending));
   body.append(figure,tips);p.content.append(body);
   pages.push(p.card);
  });
  p=page('从下一次选择开始',6);
  const list=node('ol','album-actions');
  document.querySelectorAll('.reference-next-steps li').forEach(li=>list.append(node('li','',li.textContent)));
  if(!list.children.length){
   [text('#res-makeup-recipe'),text('#res-outfit-formula'),text('#res-accessory')].filter(value=>value&&value!=='...').forEach(value=>list.append(node('li','',value)));
  }
  const closing=node('blockquote','album-closing');
  closing.append(node('span','','愿你每一次照镜子，'),node('span','','都更接近喜欢的自己。'));
  p.content.append(list,node('p','album-copy',text('.archive-avoid-note')),strip(colors.slice(0,4)),closing,node('p','album-small','色彩是一种参考，不是新的标准。'));
  pages.push(p.card);return pages;
 }
 function assertPageFits(card){
  const content=card.querySelector('.album-content');
  const footer=card.querySelector('.album-footer');
  const pageIndex=card.dataset?.albumPage||'?';
  if(!content||content.scrollHeight>content.clientHeight+1||content.scrollWidth>content.clientWidth+1||card.scrollHeight>card.clientHeight+1||card.scrollWidth>card.clientWidth+1)throw Error('page overflow:'+pageIndex);
  const cardBoundary=card.getBoundingClientRect();
  const footerBoundary=footer?.getBoundingClientRect();
  if(!footerBoundary||footerBoundary.bottom>cardBoundary.bottom+1||footerBoundary.left<cardBoundary.left-1||footerBoundary.right>cardBoundary.right+1)throw Error('page overflow:'+pageIndex);
  const boundary=content.getBoundingClientRect();
  for(const element of content.querySelectorAll('*')){
   const rect=element.getBoundingClientRect();
   if(rect.width&&rect.height&&(rect.bottom>boundary.bottom+1||rect.right>boundary.right+1||rect.left<boundary.left-1))throw Error('page overflow:'+pageIndex);
  }
 }
 window.generateReferenceAlbum=async button=>{
  if(reportExportInProgress){showToast('图片正在整理，请稍候');return;}
  const idle=button.textContent;
  let host;
  reportExportInProgress=true;button.disabled=true;button.setAttribute('aria-busy','true');
  try{
   button.textContent='正在准备图片与字体';
   await window.loadReportVendor('canvas');
   await waitForAsset(document.fonts.ready);
   const pages=compose();host=node('div','reference-album-stage');host.setAttribute('aria-hidden','true');host.append(...pages);document.body.append(host);
   await Promise.all([...host.querySelectorAll('img')].map(async image=>{
    image.loading='eager';
    try{
     await waitForAsset(image.decode());
     if(!image.naturalWidth||!image.naturalHeight)throw Error('image unavailable');
    }catch{
     const figure=image.parentElement;figure.replaceChildren(node('p','album-copy','风格示例图未能加载'),node('p','album-small','本页仅提供配色与文字参考，未包含人物示例图。'));figure.dataset.missingReference='true';
    }
   }));
   const files=[];
   for(let i=0;i<pages.length;i++){
    button.textContent='正在整理图册 · '+(i+1)+' / 6';
    // Render every card at the same stage origin. Keeping six 720px cards stacked
    // off-screen makes html2canvas crop the last card on some Chromium builds.
    host.replaceChildren(pages[i]);
    assertPageFits(pages[i]);
    window.prepareReferenceColorCuesForExport(pages[i]);
    const canvas=await html2canvas(pages[i],{scale:2,backgroundColor:'#fbf8f3',logging:false,useCORS:true});
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('canvas unavailable');
    files.push(new File([blob],'拾色季_示例图册_'+(i+1)+'.png',{type:'image/png'}));
    canvas.width=1;canvas.height=1;
   }
   const missing=host.querySelectorAll('[data-missing-reference]').length;
   deliverGeneratedFiles(files,{title:'六页色彩图册已生成',description:'6 张 1080 × 1440 图片。AI 风格参考，非本人试妆或试穿效果。'+(missing?'其中 '+missing+' 页未包含人物示例图，已明确标注并保留文字建议。':''),returnFocus:button});
  }catch(error){
   console.error('[reference-album]',error.message);
   showCustomAlert(error.message.startsWith('page overflow')?'当前报告内容超出六页图册安全区，未交付裁切图片。请先保存高清长图查看完整内容。':'图册暂未完整生成，未交付缺页图片。请确认报告加载完成后重试，也可先保存长图。');
  }finally{
   host?.remove();reportExportInProgress=false;button.disabled=false;button.removeAttribute('aria-busy');button.textContent=idle;
  }
 };
})();
