import assert from 'node:assert/strict';
import test from 'node:test';
import { createStyleImageHandler } from '../api/generate-style-image.js';
import { COLOR_DIMENSION_OPTIONS } from '../lib/color-framework.js';
import { createVisualToken, verifyStyleImageWorkerToken } from '../lib/analysis-token.js';

const CODE_HASH = 'a'.repeat(64);
const REQUEST_ID = '11111111-1111-4111-a111-111111111111';
const SOURCE_PATH_PATTERN = new RegExp(`^${REQUEST_ID}/[0-9a-f-]{36}\\.png$`, 'i');
const RESULT_PATH = `${CODE_HASH}/${REQUEST_ID}/beauty.png`;
const TEST_SECRET = 'style-image-handler-test-secret-123456789';

function analysisResult() {
  return {
    description: '整体色彩柔和。',
    color_impression: '像薄雾花园般安静柔和。',
    feature_colors: [
      { label: '肌肤底色', hex: '#AABBCC' },
      { label: '面颊色调', hex: '#DDBBCC' },
      { label: '原生发色', hex: '#332E31' },
      { label: '瞳孔特征', hex: '#403A3B' },
    ],
    dimension_data: COLOR_DIMENSION_OPTIONS.map(({ key, name }, index) => ({
      key,
      name,
      value: 40 + index,
      observation: `${name}观察结果`,
    })),
  };
}

let requestSequence = 0;

function request(analysis, overrides = {}) {
  requestSequence += 1;
  return {
    method: 'POST',
    headers: { 'x-forwarded-for': `198.51.100.${requestSequence}` },
    body: {
      kind: 'beauty',
      imageBase64: 'data:image/png;base64,AA==',
      visualToken: createVisualToken(CODE_HASH, REQUEST_ID, analysis),
      requestId: REQUEST_ID,
      analysis,
      ...overrides,
    },
  };
}

function response() {
  const output = { headers: {} };
  const res = {
    setHeader(name, value) { output.headers[name] = value; },
    status(code) { output.statusCode = code; return res; },
    json(payload) { output.payload = payload; return res; },
  };
  return { res, output };
}

function dependencies(overrides = {}) {
  return {
    env: {},
    claimJob: async () => ({ status: 'claimed', stage: 'claimed', sourcePath: null }),
    dispatchBackground: async () => {},
    saveSource: async () => true,
    signImage: async () => 'https://storage.example/signed-image',
    uploadPhoto: async () => ({ stored: true, existed: false }),
    ...overrides,
  };
}

const originalSecret = process.env.AUTH_TOKEN_SECRET;
test.before(() => { process.env.AUTH_TOKEN_SECRET = TEST_SECRET; });
test.after(() => {
  if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
  else process.env.AUTH_TOKEN_SECRET = originalSecret;
});

test('maintenance switch blocks generation before authorization or storage access', async () => {
  let claimed = false;
  const handler = createStyleImageHandler(dependencies({
    env: { STYLE_IMAGE_GENERATION_ENABLED: 'false' },
    claimJob: async () => { claimed = true; throw new Error('must not claim'); },
  }));
  const result = response();
  await handler({ method: 'POST', headers: {}, body: {} }, result.res);
  assert.equal(result.output.statusCode, 503);
  assert.equal(result.output.headers['Retry-After'], '300');
  assert.equal(claimed, false);
});

test('stores the source once and durably dispatches a signed background job', async () => {
  const analysis = analysisResult();
  const uploads = [];
  const savedSources = [];
  const dispatches = [];
  const handler = createStyleImageHandler(dependencies({
    uploadPhoto: async (...args) => { uploads.push(args); return { stored: true }; },
    saveSource: async (...args) => { savedSources.push(args); return true; },
    dispatchBackground: async (...args) => { dispatches.push(args); },
  }));

  const result = response();
  await handler(request(analysis), result.res);

  assert.equal(result.output.statusCode, 202);
  assert.equal(result.output.payload.status, 'processing');
  assert.equal(uploads.length, 1);
  assert.match(uploads[0][0], SOURCE_PATH_PATTERN);
  assert.match(savedSources[0].at(-1), SOURCE_PATH_PATTERN);
  assert.equal(dispatches.length, 1);
  const message = JSON.parse(dispatches[0][1]);
  const claims = verifyStyleImageWorkerToken(message.workerToken);
  assert.equal(claims.kind, 'beauty');
  assert.equal(claims.requestId, REQUEST_ID);
  assert.match(claims.photoPath, SOURCE_PATH_PATTERN);
  assert.match(dispatches[0][2], new RegExp(`${REQUEST_ID}-beauty-generate$`));
});

test('polling a submitting job never dispatches a second paid request', async () => {
  const analysis = analysisResult();
  let dispatched = false;
  let uploaded = false;
  const handler = createStyleImageHandler(dependencies({
    claimJob: async () => ({ status: 'claimed', stage: 'submitting', sourcePath: `${REQUEST_ID}/owner.png` }),
    dispatchBackground: async () => { dispatched = true; },
    uploadPhoto: async () => { uploaded = true; },
  }));

  const result = response();
  await handler(request(analysis, { imageBase64: undefined, retry: true }), result.res);
  assert.equal(result.output.statusCode, 202);
  assert.equal(dispatched, false);
  assert.equal(uploaded, false);
});

test('provider-completed jobs are requeued for persistence without resending the source', async () => {
  const analysis = analysisResult();
  const sourcePath = `${REQUEST_ID}/22222222-2222-4222-a222-222222222222.png`;
  const dispatches = [];
  const handler = createStyleImageHandler(dependencies({
    claimJob: async () => ({ status: 'processing', stage: 'provider_completed', sourcePath }),
    dispatchBackground: async (...args) => { dispatches.push(args); },
    uploadPhoto: async () => { throw new Error('must not upload'); },
  }));

  const result = response();
  await handler(request(analysis, { imageBase64: undefined }), result.res);
  assert.equal(result.output.statusCode, 202);
  assert.equal(dispatches.length, 1);
  assert.match(dispatches[0][2], /-beauty-persist$/);
});

test('completed jobs reuse the private stored result through a fresh signed URL', async () => {
  const analysis = analysisResult();
  const handler = createStyleImageHandler(dependencies({
    claimJob: async () => ({ status: 'completed', stage: 'completed', resultPath: RESULT_PATH }),
  }));
  const result = response();
  await handler(request(analysis, { imageBase64: undefined }), result.res);
  assert.equal(result.output.statusCode, 200);
  assert.equal(result.output.payload.reused, true);
  assert.equal(result.output.payload.imageUrl, 'https://storage.example/signed-image');
});
