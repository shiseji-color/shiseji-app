import assert from 'node:assert/strict';
import test from 'node:test';
import { DuplicateMessageError } from '@vercel/queue';
import { createBackgroundDispatcher } from '../lib/background-analysis-dispatch.js';

test('Vercel durably publishes the worker token without calling a Netlify URL', async () => {
  const messages = [];
  let fetched = false;
  const dispatch = createBackgroundDispatcher({
    env: { VERCEL: '1' },
    sendQueue: async (...args) => { messages.push(args); },
    fetchImpl: async () => { fetched = true; throw new Error('must not fetch'); },
  });

  await dispatch({ headers: {} }, '{"workerToken":"test"}', 'task-id');
  assert.equal(fetched, false);
  assert.deepEqual(messages, [[
    'analysis-jobs',
    { workerToken: 'test' },
    { idempotencyKey: 'analysis-task-id', retentionSeconds: 3600 },
  ]]);
});

test('Vercel treats the same durable queue idempotency key as already accepted', async () => {
  const dispatch = createBackgroundDispatcher({
    env: { VERCEL: '1' },
    sendQueue: async (topic, payload, options) => {
      throw new DuplicateMessageError('duplicate', options.idempotencyKey);
    },
  });

  await dispatch({ headers: {} }, '{"workerToken":"test"}', 'same-task');
});

test('Vercel still rejects unrelated queue publishing failures', async () => {
  const dispatch = createBackgroundDispatcher({
    env: { VERCEL: '1' },
    sendQueue: async () => { throw new Error('queue unavailable'); },
  });

  await assert.rejects(
    dispatch({ headers: {} }, '{"workerToken":"test"}', 'task-id'),
    /queue unavailable/,
  );
});

test('Netlify keeps dispatching to its authenticated background function', async () => {
  const calls = [];
  const dispatch = createBackgroundDispatcher({
    env: { DEPLOY_PRIME_URL: 'https://preview.example' },
    worker: async () => { throw new Error('must not run inline'); },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(null, { status: 202 });
    },
  });

  await dispatch({ headers: { host: 'preview.example' } }, '{"workerToken":"test"}');
  assert.equal(calls[0].url, 'https://preview.example/.netlify/functions/analyze-background');
  assert.equal(calls[0].options.body, '{"workerToken":"test"}');
});
