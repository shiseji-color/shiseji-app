import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackgroundStyleImageHandler } from '../lib/background-style-image-worker.js';
import { COLOR_DIMENSION_OPTIONS } from '../lib/color-framework.js';

const CODE_HASH = 'a'.repeat(64);
const REQUEST_ID = '11111111-1111-4111-a111-111111111111';
const OWNER_ID = '22222222-2222-4222-a222-222222222222';
const PHOTO_PATH = `${REQUEST_ID}/${OWNER_ID}.png`;
const RESULT_PATH = `${CODE_HASH}/${REQUEST_ID}/beauty.png`;

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
      key, name, value: 40 + index, observation: `${name}观察结果`,
    })),
  };
}

function claims() {
  return {
    codeHash: CODE_HASH,
    requestId: REQUEST_ID,
    taskId: REQUEST_ID,
    ownerId: OWNER_ID,
    kind: 'beauty',
    photoPath: PHOTO_PATH,
    analysis: analysisResult(),
  };
}

function dependencies(overrides = {}) {
  const workerClaims = claims();
  return {
    env: {
      API_KEY: 'test-key',
      IMAGE_BASE_URL: 'https://workspace.example/api/v1',
    },
    beginSubmission: async () => true,
    claimJob: async () => ({ status: 'claimed', stage: 'claimed', resultUrl: null }),
    completeJob: async () => true,
    deletePhoto: async () => {},
    downloadPhoto: async () => 'data:image/png;base64,AA==',
    failJob: async () => true,
    persistImage: async () => RESULT_PATH,
    saveProviderResult: async () => true,
    verifyWorkerToken: () => workerClaims,
    ...overrides,
  };
}

test('synchronous provider output is checkpointed before private persistence', async () => {
  const events = [];
  const worker = createBackgroundStyleImageHandler(dependencies({
    fetchImpl: async (_url, options) => {
      events.push(['provider', options.headers]);
      return new Response(JSON.stringify({
        output: { choices: [{ message: { content: [{ image: 'https://cdn.example/result.png' }] } }] },
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    },
    saveProviderResult: async (...args) => { events.push(['checkpoint', args.at(-1)]); return true; },
    persistImage: async ({ sourceUrl }) => { events.push(['persist', sourceUrl]); return RESULT_PATH; },
    completeJob: async (...args) => { events.push(['complete', args.at(-1)]); return true; },
    deletePhoto: async (path) => { events.push(['cleanup', path]); },
  }));

  await worker({ body: JSON.stringify({ workerToken: 'signed' }) });
  assert.deepEqual(events.map(([name]) => name), [
    'provider', 'checkpoint', 'persist', 'cleanup', 'complete',
  ]);
  assert.equal(events[0][1]['X-DashScope-Async'], undefined);
  assert.equal(events[1][1], 'https://cdn.example/result.png');
});

test('a duplicate worker cannot resubmit while the provider outcome is unknown', async () => {
  let providerCalls = 0;
  let beginCalls = 0;
  const worker = createBackgroundStyleImageHandler(dependencies({
    claimJob: async () => ({ status: 'claimed', stage: 'submitting', resultUrl: null }),
    beginSubmission: async () => { beginCalls += 1; return true; },
    fetchImpl: async () => { providerCalls += 1; throw new Error('must not call'); },
  }));
  await worker({ body: JSON.stringify({ workerToken: 'signed' }) });
  assert.equal(beginCalls, 0);
  assert.equal(providerCalls, 0);
});

test('a connection failure after submission stays locked and is never marked retryable', async () => {
  let failures = 0;
  const worker = createBackgroundStyleImageHandler(dependencies({
    fetchImpl: async () => { throw new TypeError('network'); },
    failJob: async () => { failures += 1; return true; },
  }));
  await worker({ body: JSON.stringify({ workerToken: 'signed' }) });
  assert.equal(failures, 0);
});

test('an explicit provider rejection is safely marked failed', async () => {
  const diagnostics = [];
  const worker = createBackgroundStyleImageHandler(dependencies({
    fetchImpl: async () => new Response(JSON.stringify({ code: 'InvalidParameter' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
    failJob: async (...args) => { diagnostics.push(args.at(-1)); return true; },
  }));
  await worker({ body: JSON.stringify({ workerToken: 'signed' }) });
  assert.deepEqual(diagnostics, ['style_image_model_rejected']);
});

test('a checkpointed provider result resumes persistence without another paid call', async () => {
  let providerCalls = 0;
  const persisted = [];
  const worker = createBackgroundStyleImageHandler(dependencies({
    claimJob: async () => ({
      status: 'processing',
      stage: 'provider_completed',
      resultUrl: 'https://cdn.example/checkpointed.png',
    }),
    fetchImpl: async () => { providerCalls += 1; throw new Error('must not call'); },
    persistImage: async (input) => { persisted.push(input.sourceUrl); return RESULT_PATH; },
  }));
  await worker({ body: JSON.stringify({ workerToken: 'signed' }) });
  assert.equal(providerCalls, 0);
  assert.deepEqual(persisted, ['https://cdn.example/checkpointed.png']);
});
