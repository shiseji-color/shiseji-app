import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/StoreTest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const baseUrl = new URL(process.env.STAGING_BASE_URL || 'https://staging.shiseji.com');
if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== 'staging.shiseji.com') {
  throw new Error('Live report verification is restricted to staging.shiseji.com.');
}

const plaintext = await readFile('private/test-activation-code.txt', 'utf8');
const activationCode = plaintext.match(/\bTST-[A-HJ-NP-Z2-9]{8}\b/)?.[0];
if (!activationCode) throw new Error('The private staging review key is unavailable.');

const fixturePhoto = path.resolve('虚拟测试正面照.png');
const outputDir = path.resolve('artifacts/reference-release/staging/live-e2e');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
});

const errors = [];
page.on('pageerror', error => errors.push(`page: ${error.message}`));
page.on('console', message => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('response', response => {
  if (response.status() >= 400) {
    const url = new URL(response.url());
    errors.push(`http: ${response.status()} ${url.pathname}`);
  }
});

const startedAt = Date.now();
const progressTimer = setInterval(() => {
  const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(`Staging analysis still running (${elapsedSeconds}s).`);
}, 30_000);

async function captureGeneratedPayload(prefix, expectedCount) {
  await page.waitForFunction(
    count => {
      const alert = document.querySelector('#customAlert');
      return (!window.reportExportInProgress && window.qaFiles?.length === count)
        || !alert?.classList.contains('hidden');
    },
    expectedCount,
    { timeout: 180_000 },
  );
  const alertMessage = await page.evaluate(() => {
    const alert = document.querySelector('#customAlert');
    return !alert?.classList.contains('hidden')
      ? document.querySelector('#alertMessage')?.textContent?.trim()
      : '';
  });
  if (alertMessage) {
    await page.screenshot({ path: path.join(outputDir, `${prefix}-failure.png`), fullPage: true });
    throw new Error(`${prefix} export failed: ${alertMessage}`);
  }
  const payloads = await page.evaluate(async () => Promise.all(
    window.qaFiles.map(async file => {
      const bytes = await file.arrayBuffer();
      const view = new DataView(bytes);
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      return {
        width: view.getUint32(16),
        height: view.getUint32(20),
        base64: String(dataUrl).split(',')[1],
      };
    }),
  ));
  const files = [];
  for (const [index, payload] of payloads.entries()) {
    const filename = `${prefix}-${String(index + 1).padStart(2, '0')}.png`;
    const bytes = Buffer.from(payload.base64, 'base64');
    await writeFile(path.join(outputDir, filename), bytes);
    files.push({ filename, width: payload.width, height: payload.height, bytes: bytes.length });
  }
  await page.evaluate(() => { window.qaFiles = []; });
  return files;
}

try {
  await page.goto(baseUrl.href, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.locator('#activationCode').fill(activationCode);
  await page.locator('#activationSubmit').click();
  await page.waitForFunction(
    () => !document.querySelector('#step-upload')?.classList.contains('hidden'),
    null,
    { timeout: 30_000 },
  );

  await page.locator('#dropzone-file').setInputFiles(fixturePhoto);
  await page.waitForFunction(
    () => document.querySelector('#uploadText')?.textContent.includes('照片已就绪'),
    null,
    { timeout: 30_000 },
  );
  await page.locator('#privacyConsent').check();
  await page.waitForFunction(
    () => !document.querySelector('#analyzeBtn')?.disabled,
    null,
    { timeout: 10_000 },
  );
  await page.locator('#analyzeBtn').click();

  await page.waitForFunction(
    () => {
      const resultVisible = !document.querySelector('#step-result')?.classList.contains('hidden');
      const alertVisible = !document.querySelector('#customAlert')?.classList.contains('hidden');
      return resultVisible || alertVisible;
    },
    null,
    { timeout: 18 * 60_000 },
  );

  await page.waitForFunction(
    () => {
      const title = document.querySelector('#res-season-name')?.textContent?.trim();
      const cover = document.querySelector('.archive-cover');
      return title && title !== '生成中' && Number.parseFloat(getComputedStyle(cover).opacity) > 0.99;
    },
    null,
    { timeout: 10_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('#captureArea')?.dataset.assetStatus
      && document.querySelectorAll('.reference-figure').length === 2,
    null,
    { timeout: 10_000 },
  );
  const assetStatus = await page.locator('#captureArea').getAttribute('data-asset-status');
  if (assetStatus === 'ready') {
    await page.waitForFunction(
      () => {
        const images = [...document.querySelectorAll(
          '#report-beauty .reference-figure img, #report-outfit .reference-figure img',
        )];
        return images.length === 2 && images.every(image => image.complete && image.naturalWidth > 0);
      },
      null,
      { timeout: 30_000 },
    );
  } else {
    await page.waitForFunction(
      () => document.querySelectorAll('.reference-figure[data-asset-state="unavailable"]').length === 2,
      null,
      { timeout: 10_000 },
    );
  }
  await page.waitForTimeout(400);

  const outcome = await page.evaluate(() => {
    const resultVisible = !document.querySelector('#step-result')?.classList.contains('hidden');
    if (!resultVisible) {
      return {
        ok: false,
        alert: document.querySelector('#alertMessage')?.textContent?.trim() || 'unknown',
      };
    }
    const referenceImages = [...document.querySelectorAll(
      '#report-beauty .reference-figure img, #report-outfit .reference-figure img',
    )];
    return {
      ok: true,
      seasonName: document.querySelector('#res-season-name')?.textContent?.trim(),
      seasonEn: document.querySelector('#res-season-en')?.textContent?.trim(),
      remainingUses: window.remainingUses,
      reportOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      assetStatus: document.querySelector('#captureArea')?.dataset.assetStatus,
      referenceImageCount: referenceImages.length,
      referenceImagesLoaded: referenceImages.every(image => image.complete && image.naturalWidth > 0),
      safeFallbackCount: document.querySelectorAll('.reference-figure[data-asset-state="unavailable"]').length,
      aiDisclosure: document.querySelector('.reference-export-note')?.textContent?.includes('AI 虚构'),
    };
  });

  if (!outcome.ok) throw new Error(`Live analysis did not complete: ${outcome.alert}`);
  const validReadyAssets = outcome.assetStatus === 'ready'
    && outcome.referenceImageCount === 2
    && outcome.referenceImagesLoaded;
  const validSafeFallback = outcome.assetStatus !== 'ready'
    && outcome.referenceImageCount === 0
    && outcome.safeFallbackCount === 2;
  if ((!validReadyAssets && !validSafeFallback) || !outcome.aiDisclosure) {
    throw new Error('Live report reference assets, safe fallback, or AI disclosure is incomplete.');
  }

  // Capture the generated File objects before the platform-specific delivery
  // branch runs. Mobile Safari without Web Share intentionally downloads files
  // directly and never opens the preview overlay.
  await page.evaluate(() => {
    window.qaFiles = [];
    window.qaDeliveryOptions = null;
    deliverGeneratedFiles = (files, options) => {
      window.qaFiles = files;
      window.qaDeliveryOptions = options;
    };
  });

  await page.locator('#xhsSaveBtn').click();
  const albumFiles = await captureGeneratedPayload('album', 6);
  if (!albumFiles.every(file => file.width === 1080 && file.height === 1440)) {
    throw new Error('One or more album pages do not use the required 1080×1440 canvas.');
  }

  await page.locator('#saveBtn').click();
  const [longFile] = await captureGeneratedPayload('long-report', 1);
  if (!longFile || longFile.width < 750 || longFile.height <= longFile.width) {
    throw new Error('The long report export dimensions are invalid.');
  }

  outcome.albumFiles = albumFiles;
  outcome.longFile = longFile;
  await page.screenshot({ path: path.join(outputDir, 'report-390.png'), fullPage: true });

  const verification = {
    ...outcome,
    viewport: '390x844',
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    errors,
  };
  await writeFile(
    path.join(outputDir, 'verification.json'),
    `${JSON.stringify(verification, null, 2)}\n`,
    'utf8',
  );
  console.log(JSON.stringify(verification, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  clearInterval(progressTimer);
  await browser.close();
}
