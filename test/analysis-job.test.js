import assert from 'node:assert/strict';
import test from 'node:test';
import { runAnalysisJob } from '../lib/analysis-job.js';

function store() {
  let status = 'queued';
  let failureCode = null;
  return {
    claim: async () => { if (status === 'queued') { status = 'processing'; return 'claimed'; } return status; },
    complete: async () => { status = 'completed'; return { completed: true }; },
    fail: async (code) => { status = 'failed'; failureCode = code; },
    status: () => status,
    failureCode: () => failureCode,
  };
}

test('concurrent duplicate jobs call the paid model once', async () => {
  const state = store();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const first = runAnalysisJob({ ...state, analyze: async () => { calls += 1; await gate; return {}; } });
  await Promise.resolve();
  const duplicate = await runAnalysisJob({ ...state, analyze: async () => { calls += 1; return {}; } });
  assert.equal(duplicate.status, 'processing');
  assert.equal(calls, 1);
  release();
  assert.equal((await first).status, 'completed');
});

test('model failure becomes terminal and does not run again for the same request', async () => {
  const state = store();
  let calls = 0;
  const failed = await runAnalysisJob({ ...state, analyze: async () => { calls += 1; throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); } });
  const retry = await runAnalysisJob({ ...state, analyze: async () => { calls += 1; return {}; } });
  assert.equal(failed.status, 'failed');
  assert.equal(state.failureCode(), 'model_timeout');
  assert.equal(retry.status, 'failed');
  assert.equal(calls, 1);
});

test('background failure and timeout paths never run completion charging', async () => {
  const state = store();
  let completions = 0;
  await runAnalysisJob({
    ...state,
    analyze: async () => { throw new Error('15 minute timeout'); },
    complete: async () => { completions += 1; return { completed: true }; },
  });
  assert.equal(state.status(), 'failed');
  assert.equal(completions, 0);
});

test('unknown completion outcome stays locked to prevent a second paid call', async () => {
  const state = store();
  let calls = 0;
  const first = await runAnalysisJob({
    ...state, analyze: async () => { calls += 1; return {}; },
    complete: async () => { throw new Error('database timeout'); },
  });
  const retry = await runAnalysisJob({ ...state, analyze: async () => { calls += 1; return {}; } });
  assert.equal(first.status, 'processing');
  assert.equal(retry.status, 'processing');
  assert.equal(calls, 1);
});
