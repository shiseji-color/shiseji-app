/* Double-gated local sample; no public report or generation API changes. */
(() => {
 const query = new URLSearchParams(location.search);
 if (!['127.0.0.1','localhost','[::1]'].includes(location.hostname) || query.get('preview') !== '1' || query.get('reference') !== 'warm-spring') return;
 const sheet=document.createElement('link'); sheet.rel='stylesheet'; sheet.href='./web/reference-preview.css'; document.head.append(sheet);
 const albumScript=document.createElement('script');albumScript.src='./web/reference-album.js';document.head.append(albumScript);
 const examples=[
  ['report-beauty','让柔暖气色，自然浮现','蜜桃豆沙、柔暖珊瑚与香槟米金，把颜色轻轻留在唇颊与眼间。','beauty','妆容参考 · 柔光暖春','AI 生成风格示例，非本人试妆效果。','参考的是配色与妆感，不必复制示例人物的五官或肤色。',[
   ['#CDA48F','唇色 · 蜜桃豆沙','先薄涂一层，保留自身唇色；想更有精神时，再轻叠唇中央。'],
   ['#D9967C','腮红 · 柔暖珊瑚','少量晕染，让唇颊色温接近。上脸后再按肤色调整浓淡。'],
   ['#B49A76','眼妆 · 香槟米金','浅色提亮眼皮，柔棕贴近睫毛根部；光泽点到为止。']
  ],'先试一种唇色，就能开始。不需要一次换掉整套化妆品。'],
  ['report-outfit','把这份温柔，穿进日常','燕麦针织搭配暖米裙装，用榛果棕配件收住轮廓。适合通勤，也适合轻松的下午。','outfit','穿搭参考 · 日常通勤 / 轻社交','AI 生成风格示例，非本人试穿效果。','借用配色关系即可，版型按自己的身形、舒适度与习惯选择。',[
   ['#D8C9B7','靠近脸部 · 燕麦米','柔和暖浅色留给上衣，针织或棉麻都可以，不必购买同款。'],
   ['#EED0B5','大面积 · 暖米色','裙装可换成直筒裤；让上下装明度接近，整体更连贯。'],
   ['#A78969','小面积 · 榛果棕','鞋、包或腰带选一到两处呼应，香槟金配饰少量点缀即可。']
  ],'先从衣橱里找出一件暖浅色上衣，让已有的衣服重新搭在一起。']
 ];
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 function render(){
  examples.forEach(([id,title,intro,kind,label,notice,why,tips,ending])=>{
   const section=document.getElementById(id); section.classList.add('reference-example');
   const figure=el('figure','reference-figure');const img=el('img','');
   img.src='./web/assets/style-references/ssj-02-'+kind+'-v2.png';img.alt=label+'，AI 生成虚构成年人物';img.decoding='async';
   img.width=kind==='beauty'?1122:1024;img.height=kind==='beauty'?1402:1536;
   img.addEventListener('error',()=>{img.hidden=true;figure.prepend(el('p','reference-why','示例图未能加载，请刷新重试。配色建议仍可阅读。'));},{once:true});
   const caption=el('figcaption','');caption.append(el('strong','',label),el('span','',notice));figure.append(img,caption);
   const list=el('dl','reference-tips');tips.forEach(([color,name,copy])=>{const row=el('div','');const term=el('dt','',name);const dot=el('span','reference-swatch');dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');term.prepend(dot);row.append(term,el('dd','',copy));list.append(row);});
   const rationale=el('p','reference-rationale',kind==='beauty'
    ? '这份示例报告呈现偏暖、柔和的倾向：因此用暖桃唇颊呼应色温，用薄涂与柔棕眼线降低妆面对比。'
    : '这份示例报告呈现中浅、低对比的倾向：因此让燕麦与暖米连成大面积，只用少量棕色配件建立轮廓。');
   const reasonLabel=el('strong','reference-reason-label','为什么选这组');
   rationale.prepend(reasonLabel);
   section.replaceChildren(el('h2','archive-title',title),el('p','archive-copy',intro),figure,rationale,el('p','reference-why',why),list,el('p','reference-ending',ending));
  });
  document.querySelectorAll('[onclick*="saveAsImage"], [onclick*="saveXhsImages"]').forEach(button=>{button.disabled=true;button.textContent='实样审核中 · 暂不导出';});
  refineReadingFlow();
  document.body.dataset.referenceReview='ready';
  if(['#report-beauty','#report-outfit'].includes(location.hash))document.querySelector(location.hash).scrollIntoView();
 }
 function refineReadingFlow(){
  const report=document.getElementById('captureArea');
  report.classList.add('reference-reading');
  const text=(selector,value)=>{const node=document.querySelector(selector);if(node)node.textContent=value;};
  text('#report-identity .archive-title','为什么是柔光暖春');
  text('#report-identity .evidence-details > summary','查看色彩依据');
  // Keep all measurements accessible, but collect them beside the explanation.
  const appendix=document.getElementById('dimensionDetails');
  document.getElementById('report-identity').append(appendix);
  appendix.open=false;
  text('#dimensionDetails summary b','完整 16 维观察');
  text('#dimensionDetails summary small','进一步了解 · 点击展开');
  text('#report-palette .archive-copy','先从靠近脸部的颜色开始；深色留给鞋包或小面积细节。');
  text('#report-styling .archive-title','按场景，找到配色');
  text('#report-styling .archive-copy','选择一个场景：主色占大面积，辅助色建立层次，点睛色少量使用。比例仅作搭配参考。');
  document.querySelector('#report-styling .styling-principle')?.remove();
  text('.report-index-links a[href="#report-beauty"]','妆容');
  text('.report-index-links a[href="#report-advice"]','行动');
  text('#report-advice .archive-title','从下一次选择开始');
  const actions=el('ol','reference-next-steps');
  ['挑一件衣橱里已有的推荐色上衣，先试一次。','在自然光下看整体气色，再决定颜色的浓淡与面积。','以穿着舒适和自己的喜好为准，不必一次改变全部。'].forEach(copy=>actions.append(el('li','',copy)));
  document.querySelector('#report-advice .archive-title').after(actions);
  text('#report-advice .archive-avoid-label','这些颜色，可以换个位置');
  text('#report-advice .archive-avoid-note','无需舍弃喜欢的颜色：放到下装或配饰，靠近面部时用推荐色过渡。');
  text('.closing-copy','色彩是一种参考，不是新的标准。愿这份档案，让日常选择更轻松。');
  // Reuse the established long-image delivery; the old six-page template stays unavailable.
  document.querySelector('.report-quick-actions')?.remove();
  const delivery=document.querySelector('.report-actions');
  const note=el('p','report-action-note','图册适合逐页分享，长图适合完整回看。两种图片均保留示例说明，不包含折叠的专业数据。');
  const album=el('button','report-action report-action-primary','生成六页示例图册');
  album.type='button';album.id='referenceAlbumBtn';
  album.addEventListener('click',async()=>{
   if(typeof window.generateReferenceAlbum!=='function'){showCustomAlert('图册组件尚未加载，请刷新后重试。');return;}
   await window.generateReferenceAlbum(album);
  });
  const save=el('button','report-action report-action-long');
  save.type='button';save.id='saveBtn';
  save.append(el('span','report-action-label','生成示例档案长图'));
  save.addEventListener('click',async()=>{
   if(save.disabled)return;
   save.disabled=true;save.setAttribute('aria-busy','true');
   const label=save.querySelector('.report-action-label');label.textContent='正在检查示例图片…';
   try{
    await Promise.race([
     Promise.all([...report.querySelectorAll('.reference-figure img')].map(image=>image.decode())),
     new Promise((_,reject)=>setTimeout(()=>reject(new Error('image timeout')),15000))
    ]);
    if([...report.querySelectorAll('.reference-figure img')].some(image=>image.hidden||!image.naturalWidth))throw new Error('image unavailable');
    label.textContent='生成示例档案长图';
    await saveAsImage();
    const overlay=document.getElementById('saveOverlay');
    if(!overlay.classList.contains('hidden')){
     document.getElementById('saveOverlayTitle').textContent='示例档案长图已生成';
     document.getElementById('saveOverlayDescription').textContent='AI 风格示例，非本人试妆或试穿效果。长按图片保存，或使用下方保存按钮。';
    }
   }catch{
    showCustomAlert('示例图片尚未完整加载，暂不生成缺图档案。请确认图片可见后重试。');
   }finally{
    save.disabled=false;save.removeAttribute('aria-busy');label.textContent='生成示例档案长图';
   }
  });
  const exportNote=el('p','reference-export-note','本地审核示例 · 柔光暖春 / V2\nAI 生成风格参考，非真实个人分析或本人试妆、试穿效果。');
  report.append(exportNote);
  const back=el('a','reference-back','回到色卡，挑一个颜色');
  back.href='#report-palette';
  delivery.replaceChildren(note,album,save,back,el('p','report-copyright','拾色季 COLOR ANALYSIS © 2026'));
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  const banner=el('aside','reference-review-bar','本地实样 · 柔光暖春 · 图像 V2 · 未发布');
  for(const [id,,,,label] of examples){const a=el('a','',label.split(' · ')[0]);a.href='#'+id;banner.append(a);}document.getElementById('step-result').prepend(banner);
  try{
   const response=await fetch('./web/assets/color-archive-concept.png');if(!response.ok)throw Error('Fixture unavailable');
   const blob=await response.blob();userImageBase64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
   setPrivacyConsentState(true);const result=document.getElementById('step-result');
   const observer=new MutationObserver(()=>{if(!result.classList.contains('hidden')){observer.disconnect();render();}});observer.observe(result,{attributes:true,attributeFilter:['class']});await startAnalysis();
  }catch{banner.textContent='本地实样未能载入，请刷新重试。未上传照片或调用生成服务。';}
 });
})();
