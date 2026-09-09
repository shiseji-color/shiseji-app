import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLabeledColors } from '../scripts/evaluate-labeled-colors.js';
// Unit fixtures only. These are not real expert annotations.
const row = (id, extra = {}) => ({ id, subjectId: 's1', photoId: 'p1', condition: 'daylight', split: 'test',
  modelVersion: 'test', promptVersion: 'test', algorithmVersion: 'test',
  label: 'SSJ-02', prediction: 'SSJ-02', labelStatus: 'adjudicated', reviewerIds: ['r1', 'r2'], ...extra });
const evaluate = samples => evaluateLabeledColors({ schemaVersion: 1, samples });

test('empty dataset reports no accuracy rather than success', () => {
  const result = evaluate([]);
  assert.equal(result.status, 'not-validated');
  assert.equal(result.accuracyPerRun, null);
  assert.equal(result.repeatAgreement, null);
});
test('counts errors and abstentions and distinguishes repeat agreement', () => {
  const result = evaluate([row('1'), row('2', { prediction: 'SSJ-01' }), row('3', { prediction: null })]);
  assert.equal(result.accuracyPerRun, 1 / 3);
  assert.equal(result.abstentionRate, 1 / 3);
  assert.equal(result.macroF1SupportedClasses, 0.5);
  assert.equal(result.repeatAgreement, 0);
  assert.equal(result.labeledTestSubjects, 1);
  assert.equal(result.supportedClasses, 1);
});
test('blocks leakage, duplicate records, mixed versions and unreviewed labels', () => {
  assert.throws(() => evaluate([row('1'), row('2', { split: 'development' })]), /leakage/);
  assert.throws(() => evaluate([row('1'), row('1')]), /Duplicate/);
  assert.throws(() => evaluate([row('1'), row('2', { modelVersion: 'other' })]), /one model/);
  assert.throws(() => evaluate([row('1', { reviewerIds: ['r1', 'r1'] })]), /review/);
});
test('unresolved labels are excluded and unanimous abstention is disclosed', () => {
  const result = evaluate([row('1', { label: null, prediction: null }), row('2', { label: null, prediction: null })]);
  assert.equal(result.labeledTestRuns, 0);
  assert.equal(result.repeatAgreement, 1);
  assert.equal(result.repeatAllAbstainGroups, 1);
});
