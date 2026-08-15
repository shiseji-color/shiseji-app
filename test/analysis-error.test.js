import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analysisFailureError,
  classifyAnalysisFailure,
  classifyModelNetworkFailure,
  runModelCall,
} from '../lib/analysis-error.js';

test('classifies provider and validation failures into a fixed safe vocabulary', () => {
  assert.equal(classifyAnalysisFailure({ status: 401 }), 'model_auth_failed');
  assert.equal(classifyAnalysisFailure({ status: 429 }), 'model_rate_limited');
  assert.equal(classifyAnalysisFailure({ status: 400 }), 'model_request_rejected');
  assert.equal(classifyAnalysisFailure({ status: 400, code: 'content_filter' }), 'model_content_rejected');
  assert.equal(classifyAnalysisFailure({ status: 503 }), 'model_unavailable');
  assert.equal(classifyAnalysisFailure({ code: 'ECONNRESET' }), 'model_unavailable');
  assert.equal(classifyAnalysisFailure({ name: 'APIConnectionError' }), 'model_unavailable');
  assert.equal(classifyAnalysisFailure({ name: 'APIError', status: 401 }), 'model_auth_failed');
  assert.equal(classifyAnalysisFailure({ name: 'APIUserAbortError' }), 'model_request_aborted');
  assert.equal(classifyAnalysisFailure({ name: 'LengthFinishReasonError' }), 'model_response_truncated');
  assert.equal(classifyAnalysisFailure({ name: 'ContentFilterFinishReasonError' }), 'model_content_rejected');
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

test('classifies native fetch failures through nested causes without reading messages', () => {
  const dnsCause = Object.assign(new Error('getaddrinfo ENOTFOUND private.example'), {
    code: 'ENOTFOUND',
    hostname: 'private.example',
  });
  const fetchFailure = new TypeError('fetch failed', {
    cause: new Error('socket setup failed', { cause: dnsCause }),
  });
  assert.equal(classifyModelNetworkFailure(fetchFailure), 'model_unavailable');
  assert.equal(classifyAnalysisFailure(fetchFailure), 'model_unavailable');

  const tlsFailure = new TypeError('fetch failed', {
    cause: Object.assign(new Error('certificate details'), {
      code: 'ERR_TLS_CERT_ALTNAME_INVALID',
      host: 'private.example',
    }),
  });
  assert.equal(classifyModelNetworkFailure(tlsFailure), 'model_unavailable');

  const aggregateFailure = new TypeError('fetch failed', {
    cause: new AggregateError([
      Object.assign(new Error('IPv6 target'), { code: 'ENETUNREACH' }),
      Object.assign(new Error('IPv4 target'), { code: 'ECONNREFUSED' }),
    ], 'connection attempts failed'),
  });
  assert.equal(classifyModelNetworkFailure(aggregateFailure), 'model_unavailable');
});

test('model boundary converts nested timeouts and connections to opaque fixed errors', async () => {
  const timeout = new TypeError('fetch failed', {
    cause: Object.assign(new Error('private URL timed out'), { code: 'UND_ERR_CONNECT_TIMEOUT' }),
  });
  await assert.rejects(runModelCall(async () => { throw timeout; }), (error) => {
    assert.equal(error.failureCode, 'model_timeout');
    assert.equal(error.message, 'Analysis failed');
    assert.doesNotMatch(JSON.stringify(error), /private|URL|fetch/i);
    return true;
  });

  const connection = new TypeError('fetch failed', {
    cause: Object.assign(new Error('private socket'), { code: 'ECONNRESET' }),
  });
  await assert.rejects(runModelCall(async () => { throw connection; }), (error) => {
    assert.equal(error.failureCode, 'model_unavailable');
    assert.equal(error.message, 'Analysis failed');
    return true;
  });
});

test('unknown TypeError remains unknown at the model boundary', async () => {
  const unknown = new TypeError('fetch failed');
  await assert.rejects(runModelCall(async () => { throw unknown; }), (error) => error === unknown);
  assert.equal(classifyAnalysisFailure(unknown), 'analysis_failed');
});
