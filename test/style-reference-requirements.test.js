import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOR_DIMENSION_KEYS, COLOR_IDENTITY_OPTIONS, applyIdentityKnowledge, deriveColorAxes } from '../lib/color-framework.js';
import { buildStyleReferenceRequirements, getStyleReferenceCoverage, resolveStyleReferences } from '../lib/style-reference-requirements.js';
import { observationsForTarget } from '../scripts/evaluate-color-framework.js';

const fixture = () => applyIdentityKnowledge({ dimension_data: COLOR_DIMENSION_KEYS.map(key => ({ key, value: 50 })) });

test('requirements use backend axes and canonical guidance, not the display title', () => {
  const input = fixture();
  const output = buildStyleReferenceRequirements({ ...input, season_name: '柔光暖春' });
  assert.equal(output.profileId, input.identity_code);
  assert.deepEqual(output.axes, deriveColorAxes(input.dimension_data));
  assert.equal(output.displayNameMismatch, true);
  assert.equal(output.requirements[0].guidance, input.makeup_advice);
  assert.equal(output.requirements[1].guidance, input.outfit_advice);
  assert.deepEqual(output.requirements[0].palette, input.best_colors);
  assert.equal(output.status, input.identity_assessment.level === 'low' ? 'review-needed' : 'ready-for-asset-review');
});

test('rejects inconsistent identity, missing, duplicate and invalid observations', () => {
  const input = fixture();
  assert.equal(buildStyleReferenceRequirements({ ...input, identity_code: 'SSJ-99' }).status, 'identity-mismatch');
  for (const value of [NaN, Infinity, -1, 101, '50', null]) {
    const changed = structuredClone(input);
    changed.dimension_data[0].value = value;
    assert.equal(buildStyleReferenceRequirements(changed).status, 'invalid-observations');
  }
  const duplicate = structuredClone(input);
  duplicate.dimension_data[0] = duplicate.dimension_data[1];
  assert.equal(buildStyleReferenceRequirements(duplicate).status, 'invalid-observations');
  assert.equal(buildStyleReferenceRequirements({}).status, 'invalid-observations');
  assert.equal(buildStyleReferenceRequirements({ season_en: 'PHOTO_NOT_ELIGIBLE' }).requirements.length, 0);
});

test('coverage lists all sixteen profiles and thirty-two released references', () => {
  const coverage = getStyleReferenceCoverage();
  assert.equal(coverage.length, 16);
  assert.equal(coverage.flatMap(p => p.kinds).length, 32);
  assert.equal(coverage.flatMap(p => p.kinds).flatMap(k => k.candidateIds).length, 32);
  assert.ok(coverage.every(p => p.kinds.every(k => k.candidateIds.length === 1)));
});

test('synthetic profile centers resolve exact references or explicit missing assets', () => {
  for (const profile of COLOR_IDENTITY_OPTIONS) {
    const result = applyIdentityKnowledge({ dimension_data: observationsForTarget(profile.target) });
    const selected = resolveStyleReferences(result, { scope: 'staging' });
    assert.equal(selected.profileId, profile.code);
    assert.equal(selected.status, 'ready');
    if (profile.code === 'SSJ-02') {
      assert.equal(selected.assets.beauty.profileId, 'SSJ-02');
      assert.equal(selected.assets.outfit.profileId, 'SSJ-02');
      assert.equal(selected.canonicalName, '杏光柔暖');
    }
    assert.equal(resolveStyleReferences(result, { scope: 'production' }).status, 'ready');
  }
});

test('resolver recomputes low confidence and rejects spoofed labels and invalid values', () => {
  const target = COLOR_IDENTITY_OPTIONS[1].target.map((v, i) => (v + COLOR_IDENTITY_OPTIONS[12].target[i]) / 2);
  const result = applyIdentityKnowledge({ dimension_data: observationsForTarget(target) });
  assert.equal(result.identity_assessment.level, 'low');
  result.identity_assessment = { level: 'high' };
  const selected = resolveStyleReferences(result, { scope: 'staging' });
  assert.equal(selected.status, 'ready');
  assert.equal(selected.assessment.level, 'low');
  assert.equal(selected.assets.beauty.profileId, result.identity_code);
  assert.equal(selected.assets.outfit.profileId, result.identity_code);
  assert.equal(resolveStyleReferences(result, { scope: 'production' }).status, 'ready');
  const good = applyIdentityKnowledge({ dimension_data: observationsForTarget(COLOR_IDENTITY_OPTIONS[1].target) });
  assert.equal(resolveStyleReferences({ ...good, identity_code: 'SSJ-99' }, { scope: 'staging' }).status, 'identity-mismatch');
  assert.equal(resolveStyleReferences({ ...good, identity_code: 'SSJ-13' }, { scope: 'staging' }).status, 'identity-mismatch');
  assert.equal(resolveStyleReferences({}, { scope: 'staging' }).status, 'invalid-observations');
  assert.equal(resolveStyleReferences({ season_en: 'PHOTO_NOT_ELIGIBLE' }, { scope: 'staging' }).status, 'photo-ineligible');
  assert.equal(resolveStyleReferences({ ...good, season_name: '柔光暖春' }, { scope: 'staging' }).canonicalName, '杏光柔暖');
});
