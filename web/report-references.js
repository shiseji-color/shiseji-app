import { resolveStyleReferences } from '../lib/style-reference-requirements.js';
import { applyIdentityKnowledge } from '../lib/color-framework.js';

// Staging and production use the same released, exact-profile reference catalog.
const host = location.hostname;
const staging = ['localhost', '127.0.0.1', '[::1]', 'staging.shiseji.com', 'shiseji-staging.vercel.app'].includes(host)
  || /^shiseji-staging-[a-z0-9-]+\.vercel\.app$/.test(host);
const el = (tag, cls, text) => {
  const n = document.createElement(tag); n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const copy = (selector, text) => { const n = document.querySelector(selector); if (n) n.textContent = text; };
window.styleReferencesMode = true;

// Rasterize each dot and label together before html2canvas renders text with
// platform-dependent font baselines. Only export clones/stages are changed.
window.prepareReferenceColorCuesForExport = root => {
  root.querySelectorAll('.reference-color-cue, #res-style-keywords > span').forEach(item => {
    const keyword = item.matches('#res-style-keywords > span');
    const label = keyword ? item : item.querySelector('b');
    const dot = item.querySelector('i');
    if (!label || (!keyword && !dot)) return;
    const view = item.ownerDocument.defaultView;
    const style = view.getComputedStyle(label);
    const dotStyle = keyword ? view.getComputedStyle(item, '::before') : view.getComputedStyle(dot);
    const rect = item.getBoundingClientRect();
    const size = parseFloat(style.fontSize);
    const diameter = parseFloat(dotStyle.width);
    const gap = parseFloat(view.getComputedStyle(item).columnGap) || 7;
    const canvas = item.ownerDocument.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    ctx.font = font;
    const width = Math.ceil(Math.max(rect.width, diameter + gap + ctx.measureText(label.textContent).width));
    const height = Math.ceil(Math.max(rect.height, size * 1.8));
    canvas.width = width * 3; canvas.height = height * 3;
    ctx.scale(3, 3); ctx.font = font;
    ctx.fillStyle = dotStyle.backgroundColor;
    ctx.globalAlpha = Number(dotStyle.opacity) || 1;
    ctx.beginPath(); ctx.arc(diameter / 2, height / 2, diameter / 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = style.color;
    const metrics = ctx.measureText(label.textContent);
    const ascent = Number.isFinite(metrics.actualBoundingBoxAscent) ? metrics.actualBoundingBoxAscent : size * .85;
    const descent = Number.isFinite(metrics.actualBoundingBoxDescent) ? metrics.actualBoundingBoxDescent : size * .15;
    const baseline = height / 2 + (ascent - descent) / 2;
    ctx.fillText(label.textContent, diameter + gap, baseline);
    // Keep the already-painted canvas. A new data-URL image created in onclone
    // can reach html2canvas before Safari has decoded it, yielding blank cues.
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', label.textContent);
    canvas.style.cssText = `display:block;width:${width}px;height:${height}px;max-width:none`;
    item.classList.add('reference-export-cue');
    item.style.setProperty('padding', '0', 'important');
    item.style.display = 'block';
    item.replaceChildren(canvas);
  });
};

const normalizedReportColors = result => (Array.isArray(result?.best_colors) ? result.best_colors : [])
  .map(color => typeof color === 'string' ? null : ({ name: color?.name, hex: color?.hex }))
  .filter(color => color?.name && /^#[0-9a-f]{6}$/i.test(color.hex || ''));

const buildColorCues = (result, kind) => {
  const colors = normalizedReportColors(result);
  const indices = kind === 'beauty' ? [0, 1, 2] : [4, 2, 0];
  const selected = indices.map(index => colors[index]).filter(Boolean);
  if (!selected.length) return null;
  const cues = el('div', 'reference-color-cues');
  cues.setAttribute('aria-label', `本次报告推荐色索引：${selected.map(color => color.name).join('、')}`);
  const label = el('small', 'reference-color-cues-label');
  label.append(
    el('span', 'reference-color-cues-label-mobile', 'COLOR NOTES'),
    el('span', 'reference-color-cues-label-desktop', '本报告推荐色 / REPORT PALETTE')
  );
  cues.append(label);
  const list = el('div', 'reference-color-cues-list');
  selected.forEach(color => {
    const item = el('span', 'reference-color-cue');
    const dot = el('i', '');
    dot.style.setProperty('--reference-cue-color', color.hex);
    dot.setAttribute('aria-hidden', 'true');
    item.append(dot, el('b', '', color.name));
    list.append(item);
  });
  cues.append(list);
  return cues;
};

window.renderStyleReferences = result => {
  if (!result) return;
  const selection = resolveStyleReferences(result, { scope: staging ? 'staging' : 'production' });
  window.currentStyleReferences = selection;
  const report = document.getElementById('captureArea');
  report.classList.add('reference-reading');
  report.dataset.assetStatus = selection.status;
  for (const kind of ['beauty', 'outfit']) {
    const section = document.getElementById('report-' + kind);
    section.classList.add('reference-example');
    section.querySelectorAll('.reference-color-cues,.reference-layout,.reference-figure,.reference-rationale,.reference-why,.reference-ending').forEach(n => n.remove());
    // Keep legacy IDs for renderer compatibility, but never show a try-on promise.
    section.querySelectorAll('.editorial-media,.editorial-figure-footer,.outfit-board').forEach(n => { n.hidden = true; });
    const asset = selection.assets?.[kind];
    if (kind === 'outfit') {
      const intro = section.querySelector('.wardrobe-intro');
      if (intro) {
        intro.removeAttribute('aria-hidden');
        intro.replaceChildren(
          el('small', '', 'WARDROBE EDIT'),
          el('h3', '', '日常穿搭参考'),
          el('p', '', asset?.description || '从靠近面部的颜色开始，搭配衣橱里已有的单品。')
        );
      }
    }
    const figure = el('figure', 'reference-figure');
    if (asset) {
      if (selection.assessment?.level === 'low') {
        figure.append(el('p', 'reference-uncertainty', '分类倾向尚待确认。下图仅示意当前推荐配色，为 AI 虚构风格示例，不代表本人效果。'));
      }
      const img = el('img', '');
      img.src = './' + asset.path; img.width = asset.width; img.height = asset.height;
      img.alt = (kind === 'beauty' ? '妆容' : '穿搭') + '配色参考，AI 生成虚构成年人物';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        img.remove();
        figure.prepend(el('p', 'reference-why', '示例图暂未加载。下方配色建议仍可阅读，保存时将保留无图说明。'));
        figure.dataset.assetState = 'unavailable';
      }, { once: true });
      figure.append(img);
    } else {
      const uncertain = ['review-needed', 'invalid-observations', 'identity-mismatch', 'photo-ineligible'].includes(selection.status);
      figure.append(el('p', 'reference-why', uncertain
        ? '本次结果暂不足以确定示例图。先将文字建议作为参考，可在稳定自然光下重新确认。'
        : '这类风格的示例图尚未收录，先保留配色与搭配建议，不用其他类型的人物图代替。'));
      figure.dataset.assetState = 'unavailable';
    }
    const caption = el('figcaption', '');
    caption.append(el('strong', '', kind === 'beauty' ? '妆容风格参考' : '日常穿搭参考'),
      el('span', '', asset?.notice || '图像仅作风格参考，不表示本人试妆或试穿效果。'));
    figure.append(caption);
    const advice = kind === 'beauty' ? result.makeup_advice : result.outfit_advice;
    const rationale = el('p', 'reference-rationale', advice || '以实际穿着感受与个人喜好为准。');
    rationale.prepend(el('strong', 'reference-reason-label', '如何借用这份配色'));
    const why = el('p', 'reference-why', kind === 'beauty'
      ? '参考的是配色与妆感，不必复制示例人物的五官或肤色。'
      : '借用配色关系即可，版型按自己的身形、舒适度与习惯选择。');
    const ending = el('p', 'reference-ending', kind === 'beauty'
      ? '先试一种唇色，不需要一次换掉整套化妆品。'
      : '从衣橱里已有的一件上衣开始，让喜欢的衣服重新搭在一起。');
    const anchor = section.querySelector(kind === 'beauty' ? '.beauty-formula' : '.wardrobe-formula');
    // General palette slots are not cosmetic shades or the pictured garment colors.
    // Keep canonical advice and the exact reference, not misleading slot labels.
    anchor?.setAttribute('hidden', '');
    const colorCues = buildColorCues(result, kind);
    const guidance = el('div', 'reference-guidance');
    guidance.append(rationale, why, ending);
    if (kind === 'outfit') {
      const guide = section.querySelector(':scope > .archive-guide');
      const articles = guide ? Array.from(guide.querySelectorAll(':scope > article')) : [];
      if (articles.length) {
        const extension = el('div', 'reference-guidance-extension');
        articles.forEach(article => {
          const note = el('section', 'reference-guidance-note');
          const heading = article.querySelector('h3')?.textContent?.trim();
          const body = article.querySelector('p')?.textContent?.trim();
          if (heading) note.append(el('h3', '', heading));
          if (body) note.append(el('p', '', body));
          if (note.childElementCount) extension.append(note);
        });
        if (extension.childElementCount) guidance.append(extension);
      }
    }
    const layout = el('div', 'reference-layout');
    layout.append(figure, guidance);
    const content = [colorCues, layout].filter(Boolean);
    if (anchor) anchor.after(...content);
    else section.append(...content);
  }
  copy('#report-beauty .archive-title', '让色彩，自然融入妆容');
  copy('#res-makeup-editorial', '从唇颊与眼妆的颜色关系开始，保留自己的特征。');
  copy('#report-outfit .archive-title', '把喜欢的配色，穿进日常');
  document.querySelector('#report-outfit .archive-title')?.replaceChildren(
    el('span', 'reference-title-phrase', '把喜欢的配色，'),
    el('span', 'reference-title-phrase', '穿进日常')
  );
  copy('#res-outfit-editorial', '配色提供方向，穿着舒适与个人喜好由你决定。');
  // The outfit recommendation remains visible even though the old generation footer is hidden.
  copy('#report-identity .archive-title', '为什么是' + (selection.canonicalName || result.season_name || '这组色彩'));
  copy('#report-styling .archive-title', '按场景，找到配色');
  copy('#report-styling .archive-copy', '主色占大面积，辅助色建立层次，点睛色少量使用。比例仅作搭配参考。');
  document.querySelector('#report-styling .styling-principle')?.setAttribute('hidden', '');
  copy('.report-index-links a[href="#report-beauty"]', '妆容');
  copy('.report-index-links a[href="#report-advice"]', '行动');
  copy('#report-advice .archive-title', '从下一次选择开始');
  if (!report.querySelector('.reference-next-steps')) {
    const list = el('ol', 'reference-next-steps');
    ['先试一件已有的推荐色上衣。', '在自然光下确认颜色的浓淡与面积。', '以舒适和自己的喜好为准，不必一次改变全部。'].forEach(t => list.append(el('li', '', t)));
    document.querySelector('#report-advice .archive-title').after(list);
  }
  const details = document.getElementById('dimensionDetails');
  document.getElementById('report-identity').append(details);
  details.open = false;
  copy('.report-action-note', '六页图册适合分享，长图适合完整回看。专业观察保留在网页中；图中人物仅为 AI 虚构风格示例。');
  document.querySelector('.reference-export-note')?.remove();
  report.append(el('p', 'reference-export-note', '拾色季 · 色彩搭配参考\nAI 虚构人物示例，非本人试妆或试穿效果。屏幕与实物可能存在色差。'));
  document.body.dataset.referenceReview = 'ready';
};

// Retain the known local review URL; it now exercises the same renderer as staging.
const query = new URLSearchParams(location.search);
if (staging && ((query.get('preview') === '1' && query.get('reference') === 'warm-spring')
    || (host === 'staging.shiseji.com' && query.get('qa') === 'report'))) {
  const boot = async () => {
    const response = await fetch('./web/assets/style-references/ssj-02-beauty-v2.png');
    if (!response.ok) return;
    const blob = await response.blob();
    userImageBase64 = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    setPrivacyConsentState(true);
    await startAnalysis();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
// Canonicalize only the synthetic fixture, never relabel a real result in the UI.
window.canonicalizeReferenceFixture = data => {
  const normalized = applyIdentityKnowledge(data);
  normalized.description = '本页使用合成观察演示报告结构，不是对示例人物的真实分析。';
  normalized.identity_assessment.message = '合成数据演示：分型由固定规则计算，不代表真人识别准确率。';
  const avatar = document.getElementById('userAvatarResult');
  const label = avatar?.parentElement.querySelector('figcaption');
  if (label) label.textContent = '虚构示例照片';
  return normalized;
};
if (window.currentAnalysisResult) window.renderStyleReferences(window.currentAnalysisResult);
