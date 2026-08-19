import assert from 'node:assert/strict';
import test from 'node:test';
import { createBackgroundDispatcher } from '../lib/background-analysis-dispatch.js';

test('Vercel defers the platform-neutral worker without calling a Netlify URL', async () => {
  const events = [];
  const deferred = [];
  let fetched = false;
  const dispatch = createBackgroundDispatcher({
    env: { VERCEL: '1' },
    defer(promise) { deferred.push(promise); },
    worker: async (event) => { events.push(event); },
    fetchImpl: async () => { fetched = true; throw new Error('must not fetch'); },
  });

  await dispatch({ headers: {} }, '{"workerToken":"test"}');
  assert.equal(fetched, false);
  assert.equal(deferred.length, 1);
  await deferred[0];
  assert.deepEqual(events, [{ body: '{"workerToken":"test"}' }]);
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
