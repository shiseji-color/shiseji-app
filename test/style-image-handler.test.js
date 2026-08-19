import assert from 'node:assert/strict';
import test from 'node:test';
import { createStyleImageHandler } from '../api/generate-style-image.js';
import { COLOR_DIMENSION_OPTIONS } from '../lib/color-framework.js';
import { createVisualToken } from '../lib/analysis-token.js';

const CODE_HASH = 'a'.repeat(64);
const REQUEST_ID = '11111111-1111-4111-a111-111111111111';
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
    env: {
      API_KEY: 'test-key',
      IMAGE_BASE_URL: 'https://workspace.example/api/v1',
    },
    beginSubmission: async () => true,
    saveProviderTask: async () => true,
    completeJob: async () => true,
    failJob: async () => true,
    persistImage: async () => RESULT_PATH,
    signImage: async () => 'https://storage.example/signed-image',
    ...overrides,
  };
}

const originalSecret = process.env.AUTH_TOKEN_SECRET;
test.before(() => { process.env.AUTH_TOKEN_SECRET = TEST_SECRET; });
test.after(() => {
  if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
  else process.env.AUTH_TOKEN_SECRET = originalSecret;
});

test('submits once, resumes by provider task ID, persists privately, and signs the result', async () => {
  const analysis = analysisResult();
  let claimCount = 0;
  const fetchUrls = [];
  const savedTaskIds = [];
  const completedPaths = [];
  const handler = createStyleImageHandler(dependencies({
    claimJob: async () => (++claimCount === 1
      ? { status: 'claimed', stage: 'claimed', providerTaskId: null }
      : { status: 'processing', stage: 'provider_submitted', providerTaskId: 'task_12345678' }),
    fetchImpl: async (url) => {
      fetchUrls.push(url);
      return new Response(JSON.stringify(fetchUrls.length === 1
        ? { output: { task_id: 'task_12345678' } }
        : { output: { task_status: 'SUCCEEDED', results: [{ url: 'https://cdn.aliyuncs.com/result.png' }] } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    saveProviderTask: async (...args) => { savedTaskIds.push(args.at(-1)); return true; },
    completeJob: async (...args) => { completedPaths.push(args.at(-1)); return true; },
  }));

  const first = response();
  await handler(request(analysis), first.res);
  assert.equal(first.output.statusCode, 202);
  assert.deepEqual(savedTaskIds, ['task_12345678']);

  const second = response();
  await handler(request(analysis, { imageBase64: undefined }), second.res);
  assert.equal(second.output.statusCode, 200);
  assert.equal(second.output.payload.status, 'completed');
  assert.equal(second.output.payload.imageUrl, 'https://storage.example/signed-image');
  assert.deepEqual(completedPaths, [RESULT_PATH]);
  assert.equal(fetchUrls.length, 2);
});

test('submission lock permits only one paid provider request across concurrent calls', async () => {
  const analysis = analysisResult();
  let lockCalls = 0;
  let providerCalls = 0;
  const handler = createStyleImageHandler(dependencies({
    claimJob: async () => ({ status: 'claimed', stage: 'claimed', providerTaskId: null }),
    beginSubmission: async () => ++lockCalls === 1,
    fetchImpl: async () => {
      providerCalls += 1;
      return new Response(JSON.stringify({ output: { task_id: 'task_12345678' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  }));
  const first = response();
  const second = response();
  await Promise.all([handler(request(analysis), first.res), handler(request(analysis), second.res)]);
  assert.equal(first.output.statusCode, 202);
  assert.equal(second.output.statusCode, 202);
  assert.equal(providerCalls, 1);
});

test('unknown submission outcome remains locked and is not marked retryable', async () => {
  const analysis = analysisResult();
  let providerCalls = 0;
  let failureWrites = 0;
  const claims = [
    { status: 'claimed', stage: 'claimed', providerTaskId: null },
    { status: 'claimed', stage: 'submitting', providerTaskId: null },
  ];
  const handler = createStyleImageHandler(dependencies({
    claimJob: async () => claims.shift(),
    fetchImpl: async () => { providerCalls += 1; throw new TypeError('network'); },
    failJob: async () => { failureWrites += 1; return true; },
  }));

  const first = response();
  await handler(request(analysis), first.res);
  assert.equal(first.output.statusCode, 502);
  assert.equal(first.output.payload.diagnosticCode, 'style_image_model_request_failed');

  const second = response();
  await handler(request(analysis, { retry: true }), second.res);
  assert.equal(second.output.statusCode, 202);
  assert.equal(providerCalls, 1);
  assert.equal(failureWrites, 0);
});
