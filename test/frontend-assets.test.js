import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frontend uses versioned local assets instead of runtime CDNs', async () => {
  const [html, cssSource, appScript, packageJson] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  assert.match(html, /\.\/web\/app\.css/);
  assert.match(appScript, /\.\/web\/vendor\/html2canvas\.min\.js/);
  assert.match(appScript, /\.\/web\/vendor\/chart\.umd\.js/);
  assert.doesNotMatch(html, /<script[^>]+vendor\//);
  assert.match(html, /\.\/web\/app\.js/);
  assert.match(html, /web\/assets\/color-archive-concept\.webp/);
  assert.match(html, /web\/assets\/color-archive-concept-fallback\.jpg/);
  assert.doesNotMatch(html, /src="web\/assets\/color-archive-concept\.png"/);
  assert.doesNotMatch(html, /cdn\.tailwindcss|cdnjs\.cloudflare|cdn\.jsdelivr|fonts\.googleapis|transparenttextures/);
  assert.doesNotMatch(cssSource, /@import\s+url\(['"]?https?:|transparenttextures/);
  assert.ok(appScript.length > 10_000);
  assert.equal(packageJson.dependencies['chart.js'], '4.4.7');
  assert.equal(packageJson.dependencies.html2canvas, '1.4.1');
  assert.equal(packageJson.devDependencies.tailwindcss, '3.4.17');
});
test('frontend keeps the project-wide adaptive viewport baseline', async () => {
  const [html, cssSource, usageRules, privacyPolicy] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
    readFile(new URL('../usage-rules.html', import.meta.url), 'utf8'),
    readFile(new URL('../privacy-policy.html', import.meta.url), 'utf8'),
  ]);

  for (const page of [html, usageRules, privacyPolicy]) {
    assert.match(page, /viewport-fit=cover/);
  }
  assert.match(cssSource, /100dvh/);
  assert.match(cssSource, /safe-area-inset-top/);
  assert.match(cssSource, /@container \(max-width:340px\)/);
  assert.match(cssSource, /orientation:landscape/);
  assert.match(cssSource, /\.identity-preview \{ min-height:clamp\(/);
});

test('homepage preview communicates the report value instead of decorative metrics', async () => {
  const [html, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /PRIVATE COLOR IDENTITY/);
  assert.match(html, /暖柔型/);
  assert.match(html, /示例结论/);
  assert.match(html, /本命色谱/);
  assert.match(html, /妆容建议/);
  assert.match(html, /穿搭方案/);
  assert.match(html, /看见属于你的/);
  assert.match(html, /从一张真实照片出发，找到本命色、妆容与穿搭方向/);
  assert.match(html, /class="activation-access-index">PRIVATE ACCESS</);
  assert.match(html, /开启一份为你准备的档案/);
  assert.ok(html.indexOf('class="identity-preview"') < html.indexOf('class="content-card activation-card'));
  assert.doesNotMatch(html, /暖柔倾向\s*<span>·<\/span>\s*中低对比/);
  assert.match(cssSource, /grid-template-columns: 1\.5fr repeat\(4, 1fr\)/);
  assert.match(cssSource, /\.preview-palette span:first-child/);
  assert.match(cssSource, /@media \(min-width:900px\)[\s\S]*?\.identity-preview picture \{[\s\S]*?aspect-ratio:6 \/ 5/);
  assert.match(cssSource, /\.activation-submit:disabled\s*\{[^}]*background: #F2EEEA/);
});

test('mobile homepage portrait stays a single in-image composition without adding document height', async () => {
  const cssSource = await readFile(new URL('../web/app.source.css', import.meta.url), 'utf8');
  assert.match(cssSource, /canonical mobile first-viewport closure/);
  assert.match(cssSource, /#step-activation \.identity-preview,[\s\S]*?display:block!important;[\s\S]*?aspect-ratio:1\.14 \/ 1!important/);
  assert.match(cssSource, /#step-activation \.identity-preview picture\s*\{[\s\S]*?position:absolute!important;[\s\S]*?inset:0!important;[\s\S]*?height:100%!important/);
  assert.match(cssSource, /#step-activation \.preview-cover-content\s*\{[\s\S]*?position:absolute!important;[\s\S]*?display:flex!important;[\s\S]*?width:5\.85rem!important;[\s\S]*?height:auto!important;[\s\S]*?min-height:0!important/);
  assert.match(cssSource, /#step-activation \.preview-palette\s*\{[\s\S]*?max-width:100%!important/);
  assert.match(cssSource, /#step-activation \.preview-metrics\s*\{\s*display:none!important/);
  assert.doesNotMatch(cssSource, /\.identity-preview\.activation-identity-preview/);
});

test('mobile activation help shares the field label row without adding a separate line', async () => {
  const cssSource = await readFile(new URL('../web/app.source.css', import.meta.url), 'utf8');
  assert.match(cssSource, /canonical mobile first-viewport closure/);
  assert.match(cssSource, /#step-activation \.activation-meta\s*\{\s*display:contents!important/);
  assert.match(cssSource, /#step-activation \.activation-card\s*\{[\s\S]*?grid-template-areas:[\s\S]*?"field field"[\s\S]*?"button button"!important/);
  assert.match(cssSource, /#step-activation \.activation-submit\s*\{[\s\S]*?grid-area:button!important/);
  assert.match(cssSource, /#step-activation \.activation-rules-link\s*\{[\s\S]*?grid-area:field!important;[\s\S]*?justify-self:end!important;[\s\S]*?min-height:0!important/);
  assert.match(cssSource, /#step-activation::after\s*\{[\s\S]*?content:none!important;[\s\S]*?display:none!important/);
  assert.match(cssSource, /#mainContainer\s*\{[\s\S]*?padding-bottom:max\(\.7rem,env\(safe-area-inset-bottom\)\)!important/);
  assert.match(cssSource, /#appHeader h1,[\s\S]*?#step-activation \.activation-access-copy h3\s*\{[\s\S]*?font-family:var\(--font-serif\)!important/);
});

test('activation input uses a Latin-friendly mobile keyboard and a single branded focus state', async () => {
  const [html, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);

  const activationInput = html.match(/<input[^>]+id="activationCode"[^>]*>/)?.[0] ?? '';
  assert.match(activationInput, /inputmode="email"/);
  assert.match(activationInput, /autocapitalize="characters"/);
  assert.match(activationInput, /autocorrect="off"/);
  assert.match(activationInput, /spellcheck="false"/);
  assert.match(activationInput, /enterkeyhint="done"/);
  assert.match(activationInput, /maxlength="12"/);
  assert.doesNotMatch(activationInput, /focus:ring|focus:border/);
  assert.match(cssSource, /#activationCode:focus-visible[\s\S]*border: 2px solid #8B6657/);
});

test('iPhone activation input prevents Safari focus zoom without locking page zoom', async () => {
  const [html, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(cssSource.includes('@supports (-webkit-touch-callout: none)'));
  assert.ok(cssSource.includes('#activationCode { font-size:16px; }'));
  assert.doesNotMatch(html, /maximum-scale|user-scalable/);
});

test('iPhone upload area directly exposes the native file input instead of label-forwarding to a hidden control', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const input = html.match(/<input id="dropzone-file"[^>]+>/)?.[0] || '';
  assert.ok(input);
  assert.ok(input.includes('type="file"'));
  assert.ok(input.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.ok(input.includes('absolute inset-0'));
  assert.ok(input.includes('h-full w-full'));
  assert.ok(input.includes('opacity-0'));
  assert.ok(input.includes('z-30'));
  assert.ok(input.includes('aria-label="拍摄或从相册选择一张正面照片"'));
  assert.doesNotMatch(input, /class="[^"]*\bhidden\b/);
});

test('mobile Safari transitions reset keyboard and page scroll after layout', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');

  assert.ok(appScript.includes('function resetPageScroll()'));
  assert.ok(appScript.includes('mainContainer.scrollTop = 0'));
  assert.ok(appScript.includes('document.scrollingElement.scrollTop = 0'));
  assert.ok(appScript.includes('window.scrollTo(0, 0)'));
  assert.ok(appScript.includes('function resetPageScrollAfterLayout()'));
  assert.ok(appScript.includes('requestAnimationFrame(resetPageScroll)'));
  assert.ok(appScript.includes('activationInput.blur()'));
  assert.ok(appScript.includes('function settleActivationViewportAfterKeyboard()'));
  assert.ok(appScript.includes('function monitorActivationKeyboardViewport(input)'));
  assert.ok(appScript.includes('function settleCompletedActivationEntry(input)'));
  assert.ok(appScript.includes("window.matchMedia('(max-width: 699px)').matches"));
  assert.ok(appScript.includes('window.visualViewport'));
  assert.ok(appScript.includes("viewport.addEventListener('resize'"));
  assert.ok(appScript.includes("viewport.addEventListener('scroll'"));
  assert.ok(appScript.includes("viewport.removeEventListener('resize'"));
  assert.ok(appScript.includes("viewport.removeEventListener('scroll'"));
  assert.ok(appScript.includes("activationInput.addEventListener('focus'"));
  assert.ok(appScript.includes("activationInput.addEventListener('blur'"));
  assert.ok(appScript.includes('monitorActivationKeyboardViewport(activationInput)'));
  assert.ok(appScript.includes('settleCompletedActivationEntry(activationInput)'));
  assert.ok(appScript.includes('settleActivationViewportAfterKeyboard()'));
  assert.ok(appScript.includes("activationStep.classList.add('activation-keyboard-open')"));
  assert.ok(appScript.includes("activationStep?.classList.remove('activation-keyboard-open')"));
  assert.ok(appScript.includes("input.scrollIntoView({ block: 'center', inline: 'nearest' })"));
  const showStepStart = appScript.indexOf('function showStep(stepId)');
  const showStepEnd = appScript.indexOf('let reportIndexObserver', showStepStart);
  assert.ok(appScript.slice(showStepStart, showStepEnd).includes('resetPageScrollAfterLayout()'));
});

test('mobile activation focus stays contained and uses a stable Safari text size', async () => {
  const cssSource = await readFile(new URL('../web/app.source.css', import.meta.url), 'utf8');
  assert.match(cssSource, /-webkit-text-size-adjust:100%/);
  assert.match(cssSource, /#step-activation #activationCode[\s\S]*font-size:16px!important/);
  assert.match(cssSource, /#step-activation #activationCode:focus,[\s\S]*outline:0!important;[\s\S]*inset 0 0 0 2px #8b5b49/);
  assert.match(cssSource, /#step-activation\.activation-keyboard-open \.activation-editorial[\s\S]*display:none!important/);
});

test('workflow hidden state wins over responsive step layout rules', async () => {
  const cssSource = await readFile(new URL('../web/app.source.css', import.meta.url), 'utf8');
  assert.match(cssSource, /#step-activation\.hidden,[\s\S]*#step-result\.hidden\s*\{\s*display:none!important;/);
});

test('privacy modal always opens at its title on mobile Safari', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');

  assert.ok(appScript.includes('function resetModalScroll(modal)'));
  assert.ok(appScript.includes('modalCopy.scrollTop = 0'));
  const privacyStart = appScript.indexOf('function showPrivacyModal()');
  const privacyEnd = appScript.indexOf('function closePrivacyModal()', privacyStart);
  const privacyBlock = appScript.slice(privacyStart, privacyEnd);
  assert.ok(privacyBlock.includes('resetModalScroll(modal)'));
  assert.ok(privacyBlock.includes('resetPageScrollAfterLayout()'));
  assert.ok(privacyBlock.includes('openModal(modal'));
});

test('draft visual review is double-gated and blocks real service calls', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');

  assert.match(appScript, /DRAFT_VISUAL_REVIEW_HOST = 'codex-production-readiness\.shiseji-app\.pages\.dev'/);
  assert.match(appScript, /STAGING_REPORT_REVIEW_HOST = 'staging\.shiseji\.com'/);
  assert.match(appScript, /window\.location\.hostname === DRAFT_VISUAL_REVIEW_HOST/);
  assert.match(appScript, /window\.location\.hostname === STAGING_REPORT_REVIEW_HOST/);
  assert.match(appScript, /\.get\('qa'\) === 'mobile'/);
  assert.match(appScript, /\.get\('qa'\) === 'report'/);

  const verificationStart = appScript.indexOf('async function verifyCode()');
  const previewVerificationGuard = appScript.indexOf('if (isLocalPreview())', verificationStart);
  const verificationRequest = appScript.indexOf("fetch('/api/verify-code'", verificationStart);
  assert.ok(verificationStart >= 0 && previewVerificationGuard > verificationStart && previewVerificationGuard < verificationRequest);


  const analysisStart = appScript.indexOf('async function startAnalysis()');
  const previewAnalysisGuard = appScript.indexOf('if (localPreview)', analysisStart);
  const analyzeRequest = appScript.indexOf("fetch('/api/start-analysis'", analysisStart);
  assert.ok(analysisStart >= 0 && previewAnalysisGuard > analysisStart && previewAnalysisGuard < analyzeRequest);
  assert.ok(!appScript.includes("fetch('/api/analyze'"));

  const styleStart = appScript.indexOf('async function generatePersonalizedStyleImage');
  const previewStyleGuard = appScript.indexOf('if (isLocalPreview())', styleStart);
  const styleRequest = appScript.indexOf("fetch('/api/generate-style-image'", styleStart);
  assert.ok(styleStart >= 0 && previewStyleGuard > styleStart && previewStyleGuard < styleRequest);

  const resetStart = appScript.indexOf('async function resetTest()');
  const previewResetGuard = appScript.indexOf('if (isLocalPreview())', resetStart);
  const verifyRequest = appScript.indexOf("fetch('/api/verify-code'", resetStart);
  assert.ok(resetStart >= 0 && previewResetGuard > resetStart && previewResetGuard < verifyRequest);
});

test('privacy consent is committed again after the modal releases the inert page', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const closeStart = appScript.indexOf('function closeModal(modal, onClosed = null)');
  const closeEnd = appScript.indexOf("document.addEventListener('keydown'", closeStart);
  const closeBlock = appScript.slice(closeStart, closeEnd);
  assert.ok(closeBlock.includes("if (typeof onClosed === 'function') onClosed()"));
  assert.ok(closeBlock.indexOf("app.removeAttribute('inert')") < closeBlock.indexOf('onClosed()'));

  const acceptStart = appScript.indexOf('function acceptPrivacy()');
  const acceptEnd = appScript.indexOf('function checkLastReport()', acceptStart);
  const acceptBlock = appScript.slice(acceptStart, acceptEnd);
  assert.ok(acceptBlock.includes('commitPrivacyConsent()'));
  assert.ok(acceptBlock.includes('closePrivacyModal(() => {'));
});

test('privacy can be accepted before photo selection while analysis remains photo-gated', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const acceptStart = appScript.indexOf('function acceptPrivacy()');
  const acceptEnd = appScript.indexOf('function handlePrivacyAccept(event)', acceptStart);
  const acceptBlock = appScript.slice(acceptStart, acceptEnd);
  assert.ok(acceptBlock.includes('commitPrivacyConsent()'));
  assert.ok(!acceptBlock.includes('userImageBase64'));
  assert.ok(appScript.includes('const disabled = !userImageBase64 || photoProcessing || photoHasBlockingIssue || !privacyConsentAccepted'));
});

test('privacy consent has one durable application state across Safari rendering and resets', async () => {
  const [appScript, cssSource] = await Promise.all([
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(appScript.includes('let privacyConsentAccepted = false'));
  assert.ok(appScript.includes('function setPrivacyConsentState(accepted)'));
  assert.ok(!appScript.includes('consent.defaultChecked = privacyConsentAccepted'));
  assert.ok(!appScript.includes("consent.toggleAttribute('checked', privacyConsentAccepted)"));
  assert.ok(appScript.includes('setPrivacyConsentState(false)'));
  assert.ok(appScript.includes('consent.dataset.accepted = String(privacyConsentAccepted)'));
  assert.ok(appScript.includes('if (clearConsent) setPrivacyConsentState(false)'));
  assert.ok(appScript.includes('if (!privacyConsentAccepted)'));
  assert.match(cssSource, /\.privacy-check\[data-accepted="true"\]/);
});

test('privacy acceptance owns touch completion and cannot be pre-empted by backdrop dismissal', async () => {
  const [html, appScript, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /<button type="button" id="privacyAcceptButton"/);
  assert.doesNotMatch(html, /id="privacyAcceptButton"[^>]+onclick=/);
  assert.ok(appScript.includes("['customAlert', 'saveOverlay'].forEach"));
  assert.ok(!appScript.includes("['privacyModal', 'customAlert', 'saveOverlay'].forEach"));
  assert.ok(appScript.includes("privacyAcceptButton.addEventListener('pointerup', handlePrivacyAccept)"));
  assert.ok(appScript.includes("privacyAcceptButton.addEventListener('click', handlePrivacyAccept)"));
  assert.ok(appScript.includes('event.stopPropagation()'));
  assert.ok(appScript.includes('let privacyAcceptancePending = false'));
  assert.ok(appScript.includes('if (privacyAcceptancePending) return'));
  assert.match(cssSource, /\.privacy-action\s*\{\s*touch-action:\s*manipulation/);
});

test('a fresh upload workflow never adopts Safari restored consent', async () => {
  const [html, appScript] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
  ]);
  assert.match(html, /id="privacyConsent" type="checkbox" autocomplete="off"/);
  assert.ok(appScript.includes('setPrivacyConsentState(false)'));
});

test('report page keeps navigation, live states, export recovery, and clean restart', async () => {
  const [html, appScript] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
  ]);
  const reportAnchors = html.match(/href="#report-[^"]+"/g) || [];
  assert.equal(reportAnchors.length, 6);
  assert.deepEqual(reportAnchors, [
    'href="#report-identity"',
    'href="#report-palette"',
    'href="#report-styling"',
    'href="#report-beauty"',
    'href="#report-outfit"',
    'href="#report-advice"',
  ]);
  assert.ok(html.indexOf('id="report-identity"') < html.indexOf('id="report-palette"'));
  assert.equal((html.match(/id="res-identity-assessment"/g) || []).length, 1);
  assert.ok(
    html.indexOf('id="res-identity-assessment"') > html.indexOf('class="archive-cover-summary"') &&
    html.indexOf('id="res-identity-assessment"') < html.indexOf('id="res-style-keywords"')
  );
  assert.ok(appScript.includes("message: '合成示例照片呈现出较明确的偏暖、偏柔倾向。结论只说明照片条件下的相对色彩关系，不是外貌评分。'"));
  assert.ok(html.includes('id="beautyGenerationState" class="generation-state hidden" data-status="idle" role="status" aria-live="polite" aria-atomic="true"'));
  assert.ok(html.includes('id="outfitGenerationState" class="generation-state hidden" data-status="idle" role="status" aria-live="polite" aria-atomic="true"'));
  assert.ok(appScript.includes("if (stepId === 'step-result') setupReportIndex()"));
  const resetStart = appScript.indexOf('async function resetTest()');
  const resetEnd = appScript.indexOf('function forceKickToHome', resetStart);
  const resetBlock = appScript.slice(resetStart, resetEnd);
  assert.ok(resetBlock.includes('clearClientWorkflow()'));
  assert.ok(resetBlock.includes("showStep('step-upload')"));
  const saveStart = appScript.indexOf('async function saveAsImage()');
  const saveBlock = appScript.slice(saveStart, appScript.indexOf('function closeSaveOverlay()', saveStart));
  assert.ok(saveBlock.includes('scrollTop: mainContainer.scrollTop'));
  assert.ok(saveBlock.includes('mainContainer.scrollTop = originalLayout.scrollTop'));
});

test('simulated report shows an honest branded color board instead of endless generation', async () => {
  const [appScript, cssSource] = await Promise.all([
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  const renderStart = appScript.indexOf('function renderAIResult(d)');
  const renderEnd = appScript.indexOf('function renderEditorialFormulas', renderStart);
  const renderBlock = appScript.slice(renderStart, renderEnd);
  assert.ok(renderBlock.includes("setPersonalizedImageState('beauty', 'preview', '季型色彩造型板 · 验收模式')"));
  assert.ok(renderBlock.includes("setPersonalizedImageState('outfit', 'preview', '季型色彩造型板 · 验收模式')"));
  assert.ok(appScript.includes("kicker.innerText = '验收模式 · 不生成效果图'"));
  assert.match(cssSource, /\.effect-share-action\.hidden\s*\{\s*display:none;\s*\}/);
  assert.match(cssSource, /#report-outfit \.outfit-board:has\(\.generation-state\[data-status="preview"\]\)[^}]*aspect-ratio:auto/);
  assert.match(cssSource, /\.archive-report \.generation-state\[data-status="preview"\]::before\s*\{[^}]*linear-gradient/);
});

test('report chapters and color evidence stay scoped, restrained, and readable', async () => {
  const [appScript, cssSource] = await Promise.all([
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(appScript.includes("const ratioRoles = ['主色', '辅助色', '点睛色', '收尾色']"));
  assert.ok(appScript.includes('class="color-ratio-legend"'));
  assert.doesNotMatch(appScript, /class="color-ratio"[^\n]+>\$\{scheme\.ratios\[colorIndex\]\}%<\/i>/);
  assert.match(cssSource, /\.archive-report\s*\{[^}]*--report-folio-gutter:#e7ded5/);
  assert.match(cssSource, /\.archive-report \.archive-section\s*\{[^}]*margin-top:0[^}]*box-shadow:none/);
  assert.match(cssSource, /\.archive-report #report-identity,[^}]*#report-styling,[^}]*#report-advice\s*\{[^}]*margin-top:12px/);
  assert.match(cssSource, /\.archive-report \.palette-primary\s*\{[^}]*1\.3fr/);
  assert.match(cssSource, /\.archive-report \.color-ratio-legend\s*\{[^}]*grid-template-columns:repeat\(4/);
  assert.match(cssSource, /\.archive-report \.palette-swatch figcaption span\s*\{[^}]*font-size:\.6875rem/);
});

test('report navigation condenses with progress and stays out of the exported archive', async () => {
  const [html, appScript, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(html.includes('class="report-index-summary"'));
  assert.ok(html.includes('class="report-index-progress"'));
  assert.ok(html.includes('class="report-quick-save"'));
  assert.ok(appScript.includes("nav.classList.add('is-condensed')"));
  assert.ok(appScript.includes("nav.classList.toggle('is-dismissed', reachedClosing)"));
  assert.ok(appScript.includes("linksContainer.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })"));
  assert.ok(appScript.includes("cloneArea.querySelectorAll('.report-index, .report-quick-actions')"));
  assert.match(cssSource, /\.archive-report \.report-index\.is-condensed \.report-index-summary\s*\{[^}]*display:grid/);
  assert.match(cssSource, /\.archive-report \.report-index-progress i\s*\{[^}]*transform:scaleX\(0\)/);
});


test('mobile report sharing preserves Safari user activation and has a visible fallback', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const deliverStart = appScript.indexOf('function deliverGeneratedImage');
  const shareStart = appScript.indexOf('async function shareGeneratedImage()', deliverStart);
  const shareEnd = appScript.indexOf('function loadEffectImage', shareStart);
  const shareBlock = appScript.slice(shareStart, shareEnd);

  assert.ok(appScript.includes('function dataURLToFile(dataURL, filename)'));
  assert.ok(appScript.includes('const objectURLs = safeFiles.map((file) => URL.createObjectURL(file))'));
  assert.ok(!shareBlock.includes('fetch(payload.dataURL)'));
  assert.ok(shareBlock.includes('files: payload.files'));
  assert.ok(shareBlock.includes('navigator.canShare(shareData)'));
  assert.ok(shareBlock.includes("link.target = '_blank'"));
  assert.ok(shareBlock.includes("window.open(payload.objectURLs[0], '_blank', 'noopener')"));
  assert.ok(appScript.includes('(payload?.objectURLs || []).forEach((url) => URL.revokeObjectURL(url))'));
});

test('share album generates six branded 3:4 files while preserving the full archive export', async () => {
  const [html, appScript, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(html.includes('onclick="saveXhsImages()"'));
  assert.ok(html.includes('生成分享图册 · 6 张'));
  assert.ok(html.includes('onclick="saveAsImage()"'));
  assert.ok(html.includes('保存高清完整长图'));
  assert.ok(appScript.includes('async function saveXhsImages()'));
  assert.ok(appScript.includes('for (let index = 0; index < 6; index += 1)'));
  assert.ok(appScript.includes('width: 900'));
  assert.ok(appScript.includes('height: 1200'));
  assert.ok(appScript.includes('scale: 1.25'));
  assert.ok(appScript.includes('deliverGeneratedFiles(files'));
  assert.ok(appScript.includes('files: payload.files'));
  assert.match(cssSource, /\.xhs-export-card\s*\{[^}]*width:900px[^}]*height:1200px/);
  assert.match(cssSource, /\.save-overlay-gallery\s*\{[^}]*scroll-snap-type:x mandatory/);
});

test('report cover preserves the original compact archive portrait at every width', async () => {
  const cssSource = await readFile(new URL('../web/app.source.css', import.meta.url), 'utf8');
  assert.match(cssSource, /\.archive-cover-main\s*\{[^}]*grid-template-columns:minmax\(clamp\(5\.4rem,24vw,7\.1rem\),\.36fr\) minmax\(0,1fr\)/);
  assert.match(cssSource, /\.archive-cover \.report-portrait\s*\{[^}]*max-width:7\.1rem/);
  assert.match(cssSource, /\.archive-cover \.report-portrait img\s*\{[^}]*aspect-ratio:4\/5[^}]*border-radius:clamp\(\.65rem,3vw,\.95rem\)/);
  assert.doesNotMatch(cssSource, /\.app-container\.report-mode \.archive-cover \.report-portrait\s*\{[^}]*max-width:none/);
  assert.doesNotMatch(cssSource, /\.app-container\.report-mode \.archive-cover \.report-portrait img\s*\{[^}]*aspect-ratio:4\s*\/\s*3/);
});

test('upload and analysis states use a wider desktop canvas without changing mobile', async () => {
  const cssSource = await readFile(new URL('../web/app.source.css', import.meta.url), 'utf8');
  assert.match(cssSource, /@media \(min-width:\s*900px\)[\s\S]*\.app-container:has\(#step-upload:not\(\.hidden\)\)[\s\S]*max-width:\s*36rem/);
  assert.match(cssSource, /#step-upload label\[for="dropzone-file"\]\s*\{[^}]*height:\s*13\.5rem/);
  assert.match(cssSource, /#step-loading \.analysis-steps\s*\{[^}]*width:\s*min\(100%,\s*22rem\)/);
});

test('share overlay actions respond on the first iPhone Safari tap without duplicate clicks', async () => {
  const [html, appScript, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(html.includes('id="shareGeneratedBtn"'));
  assert.ok(html.includes('id="saveOverlayCloseBtn"'));
  assert.ok(!html.includes('id="shareGeneratedBtn" class="save-overlay-primary" onclick='));
  assert.ok(!html.includes('id="saveOverlayCloseBtn" class="save-overlay-secondary" onclick='));
  assert.ok(appScript.includes('function bindImmediateTap(button, action, options = {})'));
  assert.ok(appScript.includes("if (typeof window.PointerEvent === 'function')"));
  assert.ok(appScript.includes("button.addEventListener('pointerup', releasePressedState)"));
  assert.ok(appScript.includes("button.addEventListener('touchend'"));
  assert.ok(appScript.includes("button.addEventListener('click', (event) =>"));
  assert.ok(appScript.includes("if (typeof options.onPress === 'function') options.onPress()"));
  assert.ok(!appScript.includes('lastDirectActivation'));
  assert.ok(!appScript.includes('Math.hypot(touch.clientX - touchStart.x'));
  assert.ok(appScript.includes("bindImmediateTap(document.getElementById('shareGeneratedBtn'), shareGeneratedImage, {"));
  assert.ok(appScript.includes("bindImmediateTap(document.getElementById('saveOverlayCloseBtn'), closeSaveOverlay)"));
  assert.ok(appScript.includes('decoding="async"'));
  assert.match(cssSource, /\.save-overlay-actions\s*\{[^}]*touch-action:manipulation/);
  assert.match(cssSource, /\.save-overlay-secondary\s*\{[^}]*touch-action:manipulation/);

  const helperStart = appScript.indexOf('function bindImmediateTap(button, action, options = {})');
  const helperEnd = appScript.indexOf('function checkLastReport()', helperStart);
  assert.ok(helperEnd > helperStart);
  const bindImmediateTap = Function('window', `${appScript.slice(helperStart, helperEnd)}; return bindImmediateTap;`)({ PointerEvent: function PointerEvent() {} });
  const listeners = new Map();
  const button = {
    classList: { add() {}, remove() {} },
    addEventListener: (type, handler) => listeners.set(type, handler),
  };
  let actionCount = 0;
  let pressFeedbackCount = 0;
  bindImmediateTap(button, () => { actionCount += 1; }, {
    onPress: () => { pressFeedbackCount += 1; },
  });
  listeners.get('pointerdown')({ type: 'pointerdown', pointerType: 'touch', isPrimary: true });
  assert.equal(pressFeedbackCount, 1);
  assert.equal(actionCount, 0);
  const pointerEvent = {
    type: 'pointerup',
    pointerType: 'touch',
    isPrimary: true,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() {},
  };
  listeners.get('pointerup')(pointerEvent);
  assert.equal(actionCount, 0);
  assert.equal(pointerEvent.defaultPrevented, false);
  listeners.get('click')({
    type: 'click',
    preventDefault() {},
    stopPropagation() {},
  });
  assert.equal(actionCount, 1);

  const shareStart = appScript.indexOf('async function shareGeneratedImage()');
  const shareEnd = appScript.indexOf('\n\n    function loadEffectImage', shareStart);
  const shareBlock = appScript.slice(shareStart, shareEnd);
  assert.ok(shareBlock.indexOf("label.textContent = '正在打开系统分享…'") < shareBlock.indexOf('await navigator.share(shareData)'));
  assert.ok(shareBlock.indexOf("setSaveOverlayStatus('已收到操作'") < shareBlock.indexOf('await navigator.share(shareData)'));
  assert.ok(appScript.includes("label.textContent = '已收到，正在打开…'"));
  assert.ok(shareBlock.includes("setSaveOverlayStatus('当前 Safari 无法一次分享 6 张'"));
  assert.ok(html.includes('z-[260]'));
});

test('share album replaces unavailable visual placeholders with complete personal prescriptions', async () => {
  const [appScript, cssSource] = await Promise.all([
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);
  assert.ok(appScript.includes("identity?.querySelector('.evidence-details, .archive-details')?.remove()"));
  assert.ok(appScript.includes('function prepareXhsVisualFragment(fragment, kind)'));
  assert.ok(appScript.includes('function buildXhsPrescription(fragment, kind)'));
  assert.ok(appScript.includes('function buildXhsManifesto()'));
  assert.ok(appScript.includes('fragment.querySelector(mediaSelector)?.remove()'));
  assert.ok(appScript.includes("content.appendChild(buildXhsManifesto())"));
  assert.ok(appScript.includes("isBeauty ? '妆容重点' : '穿搭重点'"));
  assert.ok(appScript.includes('放进生活'));
  assert.ok(appScript.includes('你的重点不是“更用力”'));
  assert.ok(!appScript.includes('xhs-prescription-sequence'));
  assert.ok(!appScript.includes('xhs-prescription-details'));
  assert.ok(!appScript.includes('formulaSelector'));
  assert.ok(appScript.includes('你的色彩签名'));
  assert.ok(!appScript.includes('未完成的造型图不会写入分享图'));
  assert.match(cssSource, /\.xhs-export-content \.wardrobe-piece small\s*\{[^}]*overflow:visible/);
  assert.match(cssSource, /\.xhs-prescription\s*\{/);
  assert.doesNotMatch(cssSource, /\.xhs-prescription-sequence\s*\{/);
  assert.doesNotMatch(cssSource, /\.xhs-prescription-details\s*\{/);
  assert.doesNotMatch(cssSource, /\.xhs-prescription\s*>\s*footer\s*\{/);
  assert.match(cssSource, /\.xhs-prescription-scenes\s*\{/);
  assert.match(cssSource, /\.xhs-prescription-verdict\s*\{/);
  assert.match(cssSource, /\.xhs-manifesto\s*\{/);
});

test('share completion is framed as delivery of a personal archive', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  assert.ok(appScript.includes("setSaveOverlayStatus('你的色彩档案已完成交付'"));
  assert.ok(appScript.includes("showToast('专属色彩档案已交付')"));
});

test('complete report exports as a high-resolution PNG within Safari canvas limits', async () => {
  const appScript = await readFile(new URL('../web/app.js', import.meta.url), 'utf8');
  const scaleStart = appScript.indexOf('function getReportExportScale(width, height)');
  const scaleEnd = appScript.indexOf('function deliverGeneratedImage', scaleStart);
  const scaleBlock = appScript.slice(scaleStart, scaleEnd);
  assert.ok(scaleStart >= 0);
  assert.ok(scaleBlock.includes('const targetWidthScale = 1440 / safeWidth'));
  assert.ok(scaleBlock.includes('const dimensionScale = 16384 / Math.max(safeWidth, safeHeight)'));
  assert.ok(scaleBlock.includes('const pixelScale = Math.sqrt(48000000 / (safeWidth * safeHeight))'));

  const saveStart = appScript.indexOf('async function saveAsImage()');
  const saveEnd = appScript.indexOf('function closeSaveOverlay()', saveStart);
  const saveBlock = appScript.slice(saveStart, saveEnd);
  assert.ok(saveBlock.includes('getReportExportScale(captureArea.scrollWidth, expandedHeight)'));
  assert.ok(saveBlock.includes('expandedHeight = captureArea.scrollHeight + 320'));
  assert.ok(saveBlock.includes('livePanel.innerHTML = panelHTML'));
  assert.ok(saveBlock.includes("canvas.toDataURL('image/png')"));
  assert.ok(saveBlock.includes("exportFilename = '拾色季_完整色彩档案.jpg'"));
  assert.ok(saveBlock.includes("'拾色季_完整色彩档案.png'"));
});
