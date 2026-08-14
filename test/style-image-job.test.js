import assert from 'node:assert/strict';
import test from 'node:test';
import { runStyleImageJob } from '../lib/style-image-job.js';

function createJobStore() {
  let job = null;
  return {
    claim(owner) {
      if (!job) {
        job = { status: 'processing', owner, resultUrl: null };
        return { status: 'claimed', resultUrl: null };
      }
      if (job.status === 'failed') {
        job = { status: 'processing', owner, resultUrl: null };
        return { status: 'claimed', resultUrl: null };
      }
      return { status: job.status, resultUrl: job.resultUrl };
    },
    complete(owner, resultUrl) {
      assert.equal(job.owner, owner);
      job = { status: 'completed', owner, resultUrl };
    },
    fail(owner) {
      assert.equal(job.owner, owner);
      job.status = 'failed';
    },
  };
}

test('reuses a completed result without another paid generation', async () => {
  const store = createJobStore();
  let generations = 0;
  const run = (owner) => runStyleImageJob({
    claim: async () => store.claim(owner),
    generate: async () => { generations += 1; return 'https://example.com/result.png'; },
    complete: async (url) => store.complete(owner, url),
    fail: async () => store.fail(owner),
  });

  assert.equal((await run('first')).reused, false);
  const repeated = await run('second');
  assert.equal(repeated.reused, true);
  assert.equal(repeated.resultUrl, 'https://example.com/result.png');
  assert.equal(generations, 1);
});

test('allows only one generator for concurrent duplicate requests', async () => {
  const store = createJobStore();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let generations = 0;
  const first = runStyleImageJob({
    claim: async () => store.claim('first'),
    generate: async () => { generations += 1; await gate; return 'https://example.com/result.png'; },
    complete: async (url) => store.complete('first', url),
    fail: async () => store.fail('first'),
  });
  await Promise.resolve();
  const duplicate = await runStyleImageJob({
    claim: async () => store.claim('second'),
    generate: async () => { generations += 1; return 'https://example.com/duplicate.png'; },
    complete: async (url) => store.complete('second', url),
    fail: async () => store.fail('second'),
  });

  assert.equal(duplicate.status, 'processing');
  assert.equal(generations, 1);
  release();
  await first;
});

test('releases a job after an explicit retryable model rejection', async () => {
  const store = createJobStore();
  await assert.rejects(() => runStyleImageJob({
    claim: async () => store.claim('first'),
    generate: async () => {
      const error = new Error('model rejected request');
      error.retryGeneration = true;
      throw error;
    },
    complete: async (url) => store.complete('first', url),
    fail: async () => store.fail('first'),
  }));

  const retried = await runStyleImageJob({
    claim: async () => store.claim('second'),
    generate: async () => 'https://example.com/retry.png',
    complete: async (url) => store.complete('second', url),
    fail: async () => store.fail('second'),
  });
  assert.equal(retried.status, 'completed');
});

test('keeps an unknown network outcome locked so retries cannot pay twice', async () => {
  const store = createJobStore();
  await assert.rejects(() => runStyleImageJob({
    claim: async () => store.claim('first'),
    generate: async () => { throw new TypeError('fetch failed'); },
    complete: async (url) => store.complete('first', url),
    fail: async () => store.fail('first'),
  }));

  let generatedAgain = false;
  const retry = await runStyleImageJob({
    claim: async () => store.claim('second'),
    generate: async () => { generatedAgain = true; return 'https://example.com/twice.png'; },
    complete: async () => {},
    fail: async () => store.fail('second'),
  });
  assert.equal(retry.status, 'processing');
  assert.equal(generatedAgain, false);
});

test('does not release the job when saving a paid result fails', async () => {
  const store = createJobStore();
  await assert.rejects(() => runStyleImageJob({
    claim: async () => store.claim('first'),
    generate: async () => 'https://example.com/paid.png',
    complete: async () => { throw new Error('database unavailable'); },
    fail: async () => store.fail('first'),
  }));

  let generatedAgain = false;
  const duplicate = await runStyleImageJob({
    claim: async () => store.claim('second'),
    generate: async () => { generatedAgain = true; return 'https://example.com/duplicate.png'; },
    complete: async () => {},
    fail: async () => store.fail('second'),
  });
  assert.equal(duplicate.status, 'processing');
  assert.equal(generatedAgain, false);
});
