import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisFailureError, classifyAnalysisFailure } from '../lib/analysis-error.js';

test('classifies provider and validation failures into a fixed safe vocabulary', () => {
  assert.equal(classifyAnalysisFailure({ status: 401 }), 'model_auth_failed');
  assert.equal(classifyAnalysisFailure({ status: 429 }), 'model_rate_limited');
  assert.equal(classifyAnalysisFailure({ status: 400 }), 'model_request_rejected');
  assert.equal(classifyAnalysisFailure({ status: 400, code: 'content_filter' }), 'model_content_rejected');
  assert.equal(classifyAnalysisFailure({ status: 503 }), 'model_unavailable');
  assert.equal(classifyAnalysisFailure({ code: 'ECONNRESET' }), 'model_unavailable');
  assert.equal(classifyAnalysisFailure(Object.assign(new Error('request timed out'), { code: 'ETIMEDOUT' })), 'model_timeout');
  assert.equal(classifyAnalysisFailure(new SyntaxError('private provider response')), 'model_invalid_json');
  assert.equal(classifyAnalysisFailure(new Error('AI response field best_colors must contain exactly 8 items')), 'model_schema_invalid');
  assert.equal(classifyAnalysisFailure(new Error('Temporary photo download failed (404)')), 'photo_download_failed');
});

test('unknown messages and untrusted diagnostic codes never reach persistent state', () => {
  const secret = new Error('https://example.invalid?api_key=secret and private model body');
  assert.equal(classifyAnalysisFailure(secret), 'analysis_failed');
  assert.equal(analysisFailureError('secret-provider-body').failureCode, 'analysis_failed');
  assert.equal(analysisFailureError('model_invalid_json').failureCode, 'model_invalid_json');
});
