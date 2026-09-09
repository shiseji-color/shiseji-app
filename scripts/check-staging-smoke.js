const DEFAULT_STAGING_URL = 'https://staging.shiseji.com';
const requestedBaseUrl = process.env.STAGING_BASE_URL || DEFAULT_STAGING_URL;

function assertSafeStagingUrl(rawUrl) {
  const url = new URL(rawUrl);
  const isCanonicalStaging = url.hostname === 'staging.shiseji.com';
  const isStagingPreview = /^shiseji-staging-[a-z0-9-]+-shiseji-colors-projects\.vercel\.app$/i.test(url.hostname);
  if (url.protocol !== 'https:' || (!isCanonicalStaging && !isStagingPreview)) {
    throw new Error('安全拦截：只允许检查拾色季 staging 或其 Preview 部署。');
  }
  return new URL(url.origin);
}

async function request(url, options) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
    ...options,
  });
  return { response, body: await response.text() };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const baseUrl = assertSafeStagingUrl(requestedBaseUrl);
  const nonce = Date.now();
  const { response: homeResponse, body: homeHtml } = await request(new URL(`/?smoke=${nonce}`, baseUrl));
  assert(homeResponse.status === 200, `主页返回 ${homeResponse.status}。`);
  assert(homeHtml.includes('color-archive-concept'), '主页缺少已冻结的档案概念主图。');
  assert(homeHtml.includes('activationCode'), '主页缺少专属密钥输入框。');
  assert(homeHtml.includes('activationSubmit'), '主页缺少开启档案按钮。');
  assert(homeResponse.headers.get('content-security-policy')?.includes("default-src 'self'"), '主页缺少 staging CSP 安全响应头。');

  for (const assetPath of ['/web/app.css', '/web/app.js', '/web/assets/color-archive-concept.webp']) {
    const { response } = await request(new URL(`${assetPath}?smoke=${nonce}`, baseUrl));
    assert(response.status === 200, `${assetPath} 返回 ${response.status}。`);
  }

  const { response: verifyResponse, body: verifyBody } = await request(new URL('/api/verify-code', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: 'INVALID' }),
  });
  const verifyPayload = JSON.parse(verifyBody);
  assert(verifyResponse.status === 400, `无效密钥返回 ${verifyResponse.status}，预期 400。`);
  assert(verifyPayload.valid === false, '无效密钥没有被明确拒绝。');

  // This endpoint checks its maintenance switch before authorization, storage,
  // queues, or the paid image provider. An empty request is therefore a safe,
  // non-billable assertion that staging generation remains disabled.
  const { response: styleResponse, body: styleBody } = await request(new URL('/api/generate-style-image', baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const stylePayload = JSON.parse(styleBody);
  assert(styleResponse.status === 503, `造型图维护开关返回 ${styleResponse.status}，预期 503。`);
  assert(styleResponse.headers.get('retry-after') === '300', '造型图维护响应缺少固定 Retry-After。');
  assert(stylePayload.error === '专属造型图正在维护，请稍后重试', '造型图维护响应不符合安全固定文案。');

  console.log(`staging 安全冒烟检查通过：${baseUrl.origin}`);
  console.log('主页、核心资源、安全响应头、密钥格式拦截与造型图维护开关均正常；未调用分析或图片模型。');
}

main().catch((error) => {
  console.error(`staging 安全冒烟检查失败：${error.message}`);
  process.exitCode = 1;
});
