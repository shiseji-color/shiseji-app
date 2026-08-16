import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelClient } from '../api/analyze.js';
import { prepareBackgroundAnalysisInput } from '../lib/background-analysis-input.js';
import { processBackgroundAnalysis } from '../lib/analysis-job-worker.js';

const claims = {
  codeHash: 'a'.repeat(64),
  requestId: 'c9a6464f-65ef-4d3e-a9f7-d7e1b443d586',
  photoPath: 'private-path-not-exposed',
};

function errorShapes() {
  return [
    new Error('private configuration'),
    new TypeError('private serialization'),
    new TypeError('outer', { cause: Object.assign(new Error('inner'), { code: 'EUNKNOWN' }) }),
    new AggregateError([new Error('first'), new TypeError('second')], 'aggregate'),
    'private string',
  ];
}

test('model client initialization failures stay in request construction stage', () => {
  for (const failure of errorShapes()) {
    assert.throws(() => createModelClient(() => { throw failure; }), (error) => {
      assert.equal(error.failureCode, 'model_request_build_failed');
      assert.equal(error.message, 'Analysis failed');
      return true;
    });
  }
});

test('production-shaped preflight failures persist the exact stage and still clean up', async () => {
  for (const failure of errorShapes()) {
    let status = 'queued';
    let persistedCode = null;
    let cleanups = 0;
    let modelCalls = 0;
    const dependencies = {
      claim: async () => {
        if (status !== 'queued') return status;
        status = 'processing';
        return 'claimed';
      },
      analyze: async () => {
        await prepareBackgroundAnalysisInput(claims, {
          downloadPhoto: async () => 'data:image/jpeg;base64,AA==',
          createToken: () => { throw failure; },
        });
        modelCalls += 1;
      },
      complete: async () => { assert.fail('completion must not run'); },
      fail: async (code) => { persistedCode = code; status = 'failed'; },
      cleanup: async () => { cleanups += 1; },
    };
    const first = await processBackgroundAnalysis(dependencies);
    const duplicate = await processBackgroundAnalysis(dependencies);
    assert.equal(first.status, 'failed');
    assert.equal(duplicate.status, 'failed');
    assert.equal(persistedCode, 'model_request_build_failed');
    assert.equal(cleanups, 1);
    assert.equal(modelCalls, 0);
  }
});

test('photo Buffer and download failures remain in photo stage', async () => {
  let tokenCalls = 0;
  for (const failure of errorShapes()) {
    await assert.rejects(prepareBackgroundAnalysisInput(claims, {
      downloadPhoto: async () => { throw failure; },
      createToken: () => { tokenCalls += 1; return 'token'; },
    }), (error) => error.failureCode === 'photo_download_failed');
  }
  assert.equal(tokenCalls, 0);
});
