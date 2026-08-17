import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseBackgroundEvent,
  runAnalysisHandler,
} from '../lib/analysis-handler-adapter.js';
import { analysisFailureError } from '../lib/analysis-error.js';
import { processBackgroundAnalysis } from '../lib/analysis-job-worker.js';

test('supports plain and base64 Netlify background event bodies', () => {
  const verify = (token) => ({ token });
  const json = JSON.stringify({ workerToken: 'opaque-token' });
  assert.deepEqual(parseBackgroundEvent({ body: json }, verify), { token: 'opaque-token' });
  assert.deepEqual(parseBackgroundEvent({
    body: Buffer.from(json).toString('base64'), isBase64Encoded: true,
  }, verify), { token: 'opaque-token' });
  assert.throws(
    () => parseBackgroundEvent({ body: '{' }, verify),
    (error) => error.failureCode === 'background_payload_invalid',
  );
});

test('reproduces delayed handler failure without a diagnostic as a fixed code', async () => {
  const startedAt = Date.now();
  const delayedFailure = (_req, res) => new Promise((resolve) => {
    setTimeout(() => {
      resolve(res.status(502).json({ error: 'private original error' }));
    }, 5_000);
  });
  await assert.rejects(runAnalysisHandler(delayedFailure, {}), (error) => {
    assert.equal(error.failureCode, 'analysis_diagnostic_missing');
    assert.equal(error.message, 'Analysis failed');
    assert.doesNotMatch(JSON.stringify(error), /private|original/i);
    return true;
  });
  assert.ok(Date.now() - startedAt >= 4_900);
});

test('preserves fixed handler diagnostics and classifies malformed success responses', async () => {
  await assert.rejects(runAnalysisHandler((_req, res) => (
    res.status(502).json({ diagnosticCode: 'model_timeout' })
  ), {}), (error) => error.failureCode === 'model_timeout');

  await assert.rejects(runAnalysisHandler((_req, res) => res.status(200).json({}), {}),
    (error) => error.failureCode === 'analysis_handler_response_invalid');

  await assert.rejects(runAnalysisHandler((_req, res) => (
    res.status(502).json({ diagnosticCode: 'analysis_failed' })
  ), {}), (error) => error.failureCode === 'analysis_handler_reported_failure');
});

test('classifies thrown values without exposing them or losing fixed diagnostics', async () => {
  await assert.rejects(runAnalysisHandler(() => { throw 'private string'; }, {}), (error) => {
    assert.equal(error.failureCode, 'analysis_handler_invoke_failed');
    assert.doesNotMatch(JSON.stringify(error), /private|string/i);
    return true;
  });
  await assert.rejects(runAnalysisHandler(async () => {
    throw new AggregateError([
      new TypeError('private nested failure'),
    ], 'private aggregate failure');
  }, {}), (error) => {
    assert.equal(error.failureCode, 'analysis_handler_invoke_failed');
    assert.doesNotMatch(JSON.stringify(error), /private|nested|aggregate/i);
    return true;
  });
  await assert.rejects(runAnalysisHandler(() => {
    throw analysisFailureError('model_invalid_json');
  }, {}), (error) => error.failureCode === 'model_invalid_json');
  await assert.rejects(runAnalysisHandler(() => {
    throw analysisFailureError('analysis_failure_classification_failed');
  }, {}), (error) => error.failureCode === 'analysis_failure_classification_failed');
});

test('production-shaped adapter fallbacks persist distinct stages and still clean up', async () => {
  const cases = [
    {
      handler: (_req, res) => res.status(502).json({ diagnosticCode: 'analysis_failed' }),
      expected: 'analysis_handler_reported_failure',
    },
    {
      handler: async () => { throw new TypeError('private handler failure'); },
      expected: 'analysis_handler_invoke_failed',
    },
  ];

  for (const { handler, expected } of cases) {
    let persistedCode = null;
    let cleanups = 0;
    const outcome = await processBackgroundAnalysis({
      claim: async () => 'claimed',
      analyze: () => runAnalysisHandler(handler, {}),
      complete: async () => { assert.fail('completion must not run'); },
      fail: async (code) => { persistedCode = code; },
      cleanup: async () => { cleanups += 1; },
    });
    assert.equal(outcome.status, 'failed');
    assert.equal(persistedCode, expected);
    assert.equal(cleanups, 1);
  }
});
