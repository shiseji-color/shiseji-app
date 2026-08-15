import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseBackgroundEvent,
  runAnalysisHandler,
} from '../lib/analysis-handler-adapter.js';
import { analysisFailureError } from '../lib/analysis-error.js';

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
  ), {}), (error) => error.failureCode === 'background_handler_failed');
});

test('classifies thrown values without exposing them or losing fixed diagnostics', async () => {
  await assert.rejects(runAnalysisHandler(() => { throw 'private string'; }, {}), (error) => {
    assert.equal(error.failureCode, 'background_handler_failed');
    assert.doesNotMatch(JSON.stringify(error), /private|string/i);
    return true;
  });
  await assert.rejects(runAnalysisHandler(() => {
    throw analysisFailureError('model_invalid_json');
  }, {}), (error) => error.failureCode === 'model_invalid_json');
});
