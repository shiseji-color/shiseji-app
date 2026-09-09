import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_IDENTITY_OPTIONS } from '../lib/color-framework.js';
import { observationsForTarget, evaluateColorFramework } from '../scripts/evaluate-color-framework.js';

test('synthetic target observations stay valid and recover each prototype', () => {
  for (const profile of COLOR_IDENTITY_OPTIONS) {
    const rows = observationsForTarget(profile.target);
    assert.equal(rows.length, 16);
    assert.ok(rows.every(d => Number.isFinite(d.value) && d.value >= 0 && d.value <= 100));
  }
  const report = evaluateColorFramework();
  assert.equal(report.summary.recovered, 16);
  assert.ok(report.centers.every(c => c.maxAxisError < 1e-10));
  assert.equal(report.summary.singleDimensionTrials, 512);
  assert.equal(report.summary.midpointTrials, 120);
  assert.equal(report.realWorldAccuracy, null);
  assert.equal(report.humanLabeledSamples, 0);
  assert.equal(report.confidenceCalibration, 'not-validated');
});

test('diagnostic benchmark is reproducible and tied midpoint cases are low confidence', () => {
  const first = evaluateColorFramework();
  assert.deepEqual(first, evaluateColorFramework());
  const ties = first.midpointCases.filter(c => c.margin < 0.01);
  assert.ok(ties.length > 0);
  assert.ok(ties.every(c => c.level === 'low'));
});
