import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAnalysisResult } from '../lib/analysis-result.js';

function capturedFailureCode(run) {
  try { run(); } catch (error) {
    assert.equal(error.message, 'Analysis failed');
    return error.failureCode;
  }
  assert.fail('expected a classified failure');
}

test('response processing emits only fixed diagnostics for unsafe model content', () => {
  assert.equal(capturedFailureCode(() => parseAnalysisResult('')), 'model_empty_response');
  assert.equal(capturedFailureCode(() => parseAnalysisResult('{private provider response')), 'model_invalid_json');
  assert.equal(capturedFailureCode(() => parseAnalysisResult('{}')), 'model_schema_invalid');
});

test('post-validation rule failures have a distinct safe diagnostic', () => {
  assert.equal(capturedFailureCode(() => parseAnalysisResult('{"private":"photo-derived data"}', {
    validate: () => ({ season_en: 'VALID' }),
    applyKnowledge: () => { throw new Error('secret rule internals'); },
  })), 'analysis_rule_failed');
});

test('photo rejection bypasses rule processing', () => {
  let applied = false;
  const result = parseAnalysisResult('{}', {
    validate: () => ({ season_en: 'PHOTO_NOT_ELIGIBLE' }),
    applyKnowledge: () => { applied = true; },
  });
  assert.equal(result.season_en, 'PHOTO_NOT_ELIGIBLE');
  assert.equal(applied, false);
});
