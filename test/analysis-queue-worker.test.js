import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnalysisQueueMessageHandler } from '../api/analysis-worker.js';

test('queue consumer forwards a bounded worker-token payload', async () => {
  const events = [];
  const handle = createAnalysisQueueMessageHandler({
    worker: async (event) => { events.push(event); },
  });

  await handle({ workerToken: 'signed-token' });

  assert.deepEqual(events, [{ body: '{"workerToken":"signed-token"}' }]);
});

test('queue consumer acknowledges malformed messages without invoking the worker', async () => {
  let called = false;
  const handle = createAnalysisQueueMessageHandler({
    worker: async () => { called = true; },
  });

  await handle({ unexpected: true });

  assert.equal(called, false);
});
