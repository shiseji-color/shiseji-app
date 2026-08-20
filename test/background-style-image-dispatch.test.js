import assert from 'node:assert/strict';
import test from 'node:test';
import { DuplicateMessageError } from '@vercel/queue';
import { createStyleImageDispatcher } from '../lib/background-style-image-dispatch.js';

test('Vercel publishes a style worker token with a phase-specific idempotency key', async () => {
  const messages = [];
  const dispatch = createStyleImageDispatcher({
    env: { VERCEL: '1' },
    sendQueue: async (...args) => { messages.push(args); },
  });
  await dispatch({ headers: {} }, '{"workerToken":"signed"}', 'request-beauty-generate');
  assert.deepEqual(messages, [[
    'style-image-jobs',
    { workerToken: 'signed' },
    { idempotencyKey: 'style-request-beauty-generate', retentionSeconds: 3600 },
  ]]);
});

test('duplicate Vercel style messages are treated as already accepted', async () => {
  const dispatch = createStyleImageDispatcher({
    env: { VERCEL: '1' },
    sendQueue: async (_topic, _payload, options) => {
      throw new DuplicateMessageError('duplicate', options.idempotencyKey);
    },
  });
  await dispatch({ headers: {} }, '{"workerToken":"signed"}', 'same');
});

test('Netlify dispatches to its authenticated background function', async () => {
  const calls = [];
  const dispatch = createStyleImageDispatcher({
    env: { DEPLOY_PRIME_URL: 'https://preview.example' },
    fetchImpl: async (...args) => { calls.push(args); return new Response(null, { status: 202 }); },
  });
  await dispatch({ headers: { host: 'preview.example' } }, '{"workerToken":"signed"}', 'ignored');
  assert.equal(calls[0][0], 'https://preview.example/.netlify/functions/style-image-background');
});
