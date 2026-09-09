import { chromium } from 'file:///C:/Users/StoreTest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.PRE_REPORT_REVIEW_URL || 'https://staging.shiseji.com/?qa=report';
const url = new URL(base);
const isGuardedStaging = url.hostname === 'staging.shiseji.com' && url.searchParams.get('qa') === 'report';
const isGuardedLocal = url.hostname === '127.0.0.1' && url.searchParams.get('qa') === 'report';
if (!(isGuardedStaging || isGuardedLocal)) {
  throw new Error('Pre-report review must use a guarded staging or local report QA URL.');
}
const homeUrl = new URL(base);
homeUrl.searchParams.delete('qa');
homeUrl.searchParams.delete('preview');
homeUrl.searchParams.delete('reference');

const out = path.resolve('artifacts/reference-release', isGuardedStaging ? 'staging/pre-report' : 'local/pre-report');
const fixturePhoto = path.resolve('web/assets/style-references/ssj-02-beauty-v2.png');
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const results = [];

for (const [width, height] of [[390, 844], [1440, 900]]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    userAgent: width === 390
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
      : undefined
  });
  const errors = [];
  const apiRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('request', request => {
    if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(new URL(request.url()).pathname);
  });

  await page.goto(homeUrl.href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#toastContainer')?.replaceChildren());
  await page.screenshot({ path: path.join(out, `home-${width}.png`), fullPage: true });
  const home = await page.evaluate(() => ({
    visible: !document.querySelector('#step-activation').classList.contains('hidden'),
    title: document.querySelector('#activation-title')?.textContent.trim(),
    intro: document.querySelector('.activation-intro-copy')?.textContent.trim(),
    previewLoaded: document.querySelector('.preview-cover-image')?.complete,
    submitDisabled: document.querySelector('#activationSubmit')?.disabled,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: innerHeight
  }));
  await page.locator('#activationCode').fill('ABCDEF123456');
  await page.waitForTimeout(180);
  const homeEntry = await page.evaluate(() => {
    const input = document.querySelector('#activationCode');
    const help = document.querySelector('.activation-rules-link');
    const portrait = document.querySelector('.identity-preview picture');
    const palette = document.querySelector('.preview-cover-content');
    const inputRect = input.getBoundingClientRect();
    const helpRect = help.getBoundingClientRect();
    const portraitRect = portrait.getBoundingClientRect();
    const paletteRect = palette.getBoundingClientRect();
    return {
      activeElementId: document.activeElement?.id || '',
      submitEnabled: !document.querySelector('#activationSubmit').disabled,
      scrollY,
      input: { left: inputRect.left, right: inputRect.right, height: inputRect.height },
      helpHeight: helpRect.height,
      portrait: { top: portraitRect.top, bottom: portraitRect.bottom, height: portraitRect.height },
      palette: {
        top: paletteRect.top,
        bottom: paletteRect.bottom,
        height: paletteRect.height,
        visible: getComputedStyle(palette).display !== 'none'
      }
    };
  });

  // The guarded report fixture loads large local reference assets and may keep
  // browser requests active. Its explicit ready marker is the stable boundary.
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.referenceReview === 'ready');
  await page.evaluate(() => {
    clearClientWorkflow();
    showStep('step-activation');
    document.querySelector('#toastContainer')?.replaceChildren();
  });
  await page.locator('#activationCode').fill('ABCDEF123456');
  await page.locator('#activationSubmit').click();
  await page.waitForFunction(() => !document.querySelector('#step-upload').classList.contains('hidden'));
  await page.waitForTimeout(700);
  await page.evaluate(() => document.querySelector('#toastContainer')?.replaceChildren());
  await page.screenshot({ path: path.join(out, `upload-empty-${width}.png`), fullPage: true });
  const uploadEmpty = await page.evaluate(() => ({
    visible: !document.querySelector('#step-upload').classList.contains('hidden'),
    heading: document.querySelector('#step-upload h2')?.textContent.trim(),
    fileInputExposed: getComputedStyle(document.querySelector('#dropzone-file')).display !== 'none',
    analyzeDisabled: document.querySelector('#analyzeBtn')?.disabled,
    consentChecked: document.querySelector('#privacyConsent')?.checked,
    guideCount: document.querySelectorAll('.photo-guide-item').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    shellWidth: document.querySelector('.app-container')?.getBoundingClientRect().width,
    cardWidth: document.querySelector('#step-upload .upload-card')?.getBoundingClientRect().width
  }));

  await page.locator('#dropzone-file').setInputFiles(fixturePhoto);
  await page.waitForFunction(() => document.querySelector('#uploadText')?.textContent.includes('照片已就绪'));
  await page.locator('#privacyConsent').check();
  await page.waitForFunction(() => !document.querySelector('#analyzeBtn').disabled);
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#toastContainer')?.replaceChildren());
  await page.screenshot({ path: path.join(out, `upload-ready-${width}.png`), fullPage: true });
  const uploadReady = await page.evaluate(() => ({
    previewVisible: !document.querySelector('#imagePreview').classList.contains('hidden'),
    previewLoaded: document.querySelector('#imagePreview').complete,
    quality: document.querySelector('#photoQuality')?.textContent.replace(/\s+/g, ' ').trim(),
    analyzeDisabled: document.querySelector('#analyzeBtn')?.disabled,
    analyzeStyle: (() => {
      const style = getComputedStyle(document.querySelector('#analyzeBtn'));
      return { background: style.backgroundColor, color: style.color, opacity: style.opacity };
    })(),
    consentChecked: document.querySelector('#privacyConsent')?.checked,
    consentStyle: (() => {
      const style = getComputedStyle(document.querySelector('#privacyConsent'));
      return { background: style.backgroundColor, border: style.borderColor, opacity: style.opacity };
    })(),
    overflow: document.documentElement.scrollWidth > innerWidth + 1
  }));

  await page.evaluate(() => { document.querySelector('#loadingText').textContent = '正在提交分析任务'; });
  await page.locator('#analyzeBtn').click();
  await page.waitForFunction(() => !document.querySelector('#step-loading').classList.contains('hidden'));
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `analysis-${width}.png`), fullPage: true });
  const analysis = await page.evaluate(() => ({
    visible: !document.querySelector('#step-loading').classList.contains('hidden'),
    heading: document.querySelector('#loadingText')?.textContent.trim(),
    steps: [...document.querySelectorAll('#analysisSteps .analysis-step')].map(node => ({
      text: node.textContent.trim(),
      active: node.classList.contains('active'),
      complete: node.classList.contains('complete')
    })),
    previewNotice: document.querySelector('#loadingPreviewStatus')?.textContent.trim(),
    previewNoticeVisible: !document.querySelector('#loadingPreviewStatus')?.classList.contains('hidden'),
    cancelVisible: getComputedStyle(document.querySelector('#analysisRecoveryBtn')).display !== 'none',
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
    shellWidth: document.querySelector('.app-container')?.getBoundingClientRect().width,
    cardWidth: document.querySelector('#step-loading .loading-card')?.getBoundingClientRect().width
  }));

  await page.locator('#analysisRecoveryBtn').click();
  await page.waitForFunction(() => !document.querySelector('#step-upload').classList.contains('hidden'));
  const cancel = await page.evaluate(() => ({
    returnedToUpload: !document.querySelector('#step-upload').classList.contains('hidden'),
    loadingHidden: document.querySelector('#step-loading').classList.contains('hidden')
  }));

  results.push({ width, height, home, homeEntry, uploadEmpty, uploadReady, analysis, cancel, errors, apiRequests });
  await page.close();
}

await browser.close();
await writeFile(path.join(out, 'verification.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

const failed = results.some(result =>
  !result.home.visible || !result.home.previewLoaded || result.home.overflow ||
  !result.homeEntry.submitEnabled ||
  result.homeEntry.input.left < -0.5 || result.homeEntry.input.right > result.width + 0.5 ||
  result.homeEntry.input.height < 44 || result.homeEntry.helpHeight < 44 ||
  (result.width === 390 && result.homeEntry.activeElementId === 'activationCode') ||
  result.homeEntry.palette.visible ||
  !result.uploadEmpty.visible || !result.uploadEmpty.fileInputExposed || !result.uploadEmpty.analyzeDisabled || result.uploadEmpty.overflow ||
  (result.width === 1440 && (result.uploadEmpty.shellWidth < 570 || result.analysis.shellWidth < 570)) ||
  (result.width === 390 && (result.uploadEmpty.shellWidth > 390.5 || result.analysis.shellWidth > 390.5)) ||
  !result.uploadReady.previewVisible || !result.uploadReady.previewLoaded || result.uploadReady.analyzeDisabled || !result.uploadReady.consentChecked || result.uploadReady.overflow ||
  Number(result.uploadReady.analyzeStyle.opacity) < 0.99 || result.uploadReady.analyzeStyle.background !== 'rgb(61, 52, 47)' ||
  result.uploadReady.consentStyle.background !== 'rgb(61, 52, 47)' ||
  !result.analysis.visible || !result.analysis.previewNoticeVisible || !result.analysis.cancelVisible || result.analysis.overflow ||
  !result.cancel.returnedToUpload || !result.cancel.loadingHidden || result.errors.length || result.apiRequests.length
);
if (failed) process.exitCode = 1;
