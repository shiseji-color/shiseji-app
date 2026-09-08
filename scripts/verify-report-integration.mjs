import { chromium } from "file:///C:/Users/StoreTest/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const requestedBaseUrl = process.env.REPORT_REVIEW_URL || "http://127.0.0.1:4174/?preview=1";
const parsedBaseUrl = new URL(requestedBaseUrl);
const isSafeLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(parsedBaseUrl.hostname)
  && parsedBaseUrl.searchParams.has("preview");
const isSafeStagingPreview = parsedBaseUrl.protocol === "https:"
  && parsedBaseUrl.hostname === "staging.shiseji.com"
  && parsedBaseUrl.searchParams.get("qa") === "report";
if (!isSafeLocalPreview && !isSafeStagingPreview) {
  throw new Error("安全拦截：报告集成验证只允许本地 preview 或 staging ?qa=report。");
}
const baseUrl = parsedBaseUrl.href;
const uploadPath = path.resolve("web/assets/color-archive-concept.png");
const reviewDir = path.resolve("artifacts/report-master/review");
await mkdir(reviewDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
});

const results = [];
for (const [width, height] of [[390, 844], [1440, 900]]) {
  const isMobile = width < 900;
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
    userAgent: isMobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      : undefined,
    acceptDownloads: true
  });
  page.setDefaultTimeout(120000);
  const errors = [];
  const downloads = [];
  page.on("download", (download) => downloads.push(download));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => showStep("step-upload"));
  await page.locator("#dropzone-file").setInputFiles(uploadPath);
  await page.locator("#privacyConsent").check();
  await page.locator("#analyzeBtn").click();
  await page.locator("#step-result:not(.hidden)").waitFor({ timeout: 5000 });
  await page.evaluate(() => {
    const alert = document.querySelector("#customAlert");
    if (alert && !alert.classList.contains("hidden") && typeof closeCustomAlert === "function") {
      closeCustomAlert();
    }
    document.querySelector("#toastContainer")?.replaceChildren();
  });
  await page.waitForTimeout(450);

  const audit = await page.evaluate(() => {
    const anchors = [...document.querySelectorAll(".report-index-links a")].map((link) => link.getAttribute("href"));
    const identity = document.querySelector("#report-identity");
    const palette = document.querySelector("#report-palette");
    const assessment = document.querySelector("#res-identity-assessment");
    const assessmentRect = assessment?.getBoundingClientRect();
    const coverRect = document.querySelector(".archive-cover")?.getBoundingClientRect();
    const appRect = document.querySelector(".app-container")?.getBoundingClientRect();
    const coverStyle = getComputedStyle(document.querySelector(".archive-cover"));
    return {
      meaningfulContent: document.body.innerText.trim().length > 500,
      errorOverlay: Boolean(document.querySelector("[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay")),
      anchors,
      identityBeforePalette: Boolean(identity && palette && (identity.compareDocumentPosition(palette) & Node.DOCUMENT_POSITION_FOLLOWING)),
      assessmentCount: document.querySelectorAll("#res-identity-assessment").length,
      assessmentText: assessment?.textContent?.trim(),
      assessmentInCover: Boolean(assessment?.closest(".archive-cover-summary")),
      assessmentVisibleInCover: Boolean(assessmentRect && coverRect && assessmentRect.top >= coverRect.top && assessmentRect.bottom <= coverRect.bottom),
      currentChapter: document.querySelector(".report-index-current")?.textContent?.trim(),
      reportMode: document.querySelector(".app-container")?.classList.contains("report-mode"),
      appWidth: Math.round(appRect?.width || 0),
      coverColumns: coverStyle.gridTemplateColumns,
      stepDisplays: Object.fromEntries(["step-activation", "step-upload", "step-loading", "step-result"].map((id) => [
        id,
        getComputedStyle(document.getElementById(id)).display
      ])),
      userPhotoVisible: getComputedStyle(document.querySelector("#userAvatarResult")).display !== "none",
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      brokenImages: [...document.images]
        .filter((image) => image.currentSrc && getComputedStyle(image).display !== "none" && (!image.complete || !image.naturalWidth))
        .map((image) => image.id || image.src)
    };
  });
  await page.screenshot({
    path: path.join(reviewDir, `integration-report-${width}x${height}.png`),
    fullPage: true
  });

  if (isMobile) {
    await page.locator("#report-identity").evaluate((section) => section.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(350);
    await page.screenshot({
      path: path.join(reviewDir, "integration-report-390x844-chapters.png")
    });
    audit.scrolledChapter = await page.evaluate(() => ({
      current: document.querySelector(".report-index-current")?.textContent?.trim(),
      count: document.querySelector(".report-index-count")?.textContent?.trim(),
      activeHref: document.querySelector('.report-index-links a[aria-current="location"]')?.getAttribute("href"),
      navPosition: getComputedStyle(document.querySelector(".report-index")).position,
      deliverySafePadding: getComputedStyle(document.querySelector(".report-actions")).paddingBottom
    }));
  }

  const albumDownloadStart = downloads.length;
  const albumExport = await page.evaluate(async () => {
    await saveXhsImages();
    return {
      files: document.querySelectorAll("#saveOverlayGallery img").length,
      visible: !document.querySelector("#saveOverlay")?.classList.contains("hidden")
    };
  });
  await page.waitForTimeout(isMobile ? 100 : 1400);
  albumExport.automaticDownloads = downloads.length - albumDownloadStart;

  if (isMobile) {
    const albumSources = await page.locator("#saveOverlayGallery img").evaluateAll((images) => images.map((image) => image.src));
    for (const [index, src] of albumSources.entries()) {
      await page.evaluate(({ src, index }) => {
        const link = document.createElement("a");
        link.href = src;
        link.download = `mobile-album-${index + 1}.png`;
        link.click();
      }, { src, index });
      await page.waitForTimeout(30);
    }
  }
  await page.evaluate(() => closeSaveOverlay());
  await page.waitForTimeout(380);

  const longDownloadStart = downloads.length;
  const longExport = await page.evaluate(async () => {
    await saveAsImage();
    return {
      files: document.querySelectorAll("#saveOverlayGallery img").length,
      visible: !document.querySelector("#saveOverlay")?.classList.contains("hidden")
    };
  });
  await page.waitForTimeout(isMobile ? 100 : 450);
  longExport.automaticDownloads = downloads.length - longDownloadStart;

  if (isMobile) {
    const longSource = await page.locator("#saveOverlayGallery img").getAttribute("src");
    await page.evaluate((src) => {
      const link = document.createElement("a");
      link.href = src;
      link.download = "mobile-complete-archive.png";
      link.click();
    }, longSource);
    await page.waitForTimeout(50);
  }
  await page.evaluate(() => closeSaveOverlay());
  await page.waitForTimeout(300);
  for (const [index, download] of downloads.entries()) {
    const suggested = download.suggestedFilename().replace(/[\\/:*?"<>|]/g, "-");
    await download.saveAs(path.join(reviewDir, `export-${width}x${height}-${String(index + 1).padStart(2, "0")}-${suggested}`));
  }
  albumExport.preservedFiles = isMobile ? 6 : albumExport.automaticDownloads;
  longExport.preservedFiles = 1;
  results.push({ width, height, errors, albumExport, longExport, ...audit });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
