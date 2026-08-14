import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COLOR_DIMENSION_OPTIONS,
  COLOR_IDENTITY_OPTIONS,
  applyIdentityKnowledge,
  assessColorIdentity,
  deriveColorAxes,
  rankColorIdentities,
  selectColorIdentity,
} from '../lib/color-framework.js';

function dimensions(overrides = {}) {
  return COLOR_DIMENSION_OPTIONS.map(({ key, name }) => ({
    key,
    name,
    value: overrides[key] ?? 50,
    observation: `${name}测试观察`,
  }));
}

test('defines sixteen complete and unique commercial identities', () => {
  assert.equal(COLOR_IDENTITY_OPTIONS.length, 16);
  assert.equal(new Set(COLOR_IDENTITY_OPTIONS.map(item => item.code)).size, 16);
  assert.equal(new Set(COLOR_IDENTITY_OPTIONS.map(item => item.name)).size, 16);

  for (const identity of COLOR_IDENTITY_OPTIONS) {
    assert.equal(identity.target.length, 5);
    assert.equal(identity.keywords.length, 3);
    assert.equal(identity.palette.length, 8);
    assert.equal(identity.avoid.length, 3);
    assert.ok(identity.makeup && identity.outfit && identity.accessory && identity.style);
    for (const [, hex] of identity.palette) assert.match(hex, /^#[0-9A-F]{6}$/i);
  }
});

test('derives stable axes from the sixteen observations', () => {
  const input = dimensions({
    skin_temperature: 80,
    cheek_temperature: 80,
    lip_temperature: 80,
    hair_temperature: 80,
    skin_lightness: 80,
    brightness_capacity: 80,
    eye_depth: 20,
    hair_depth: 20,
  });
  const axes = deriveColorAxes(input);
  assert.equal(axes.warmth, 80);
  assert.equal(axes.lightness, 80);
});

test('selects the nearest identity deterministically', () => {
  const warmSoft = dimensions({
    skin_temperature: 72, cheek_temperature: 72, lip_temperature: 72, hair_temperature: 72,
    skin_lightness: 70, brightness_capacity: 70, eye_depth: 30, hair_depth: 30,
    skin_clarity: 43, eye_clarity: 43, chroma_capacity: 43,
    skin_softness: 82, muted_capacity: 82, facial_contrast: 18,
    hair_skin_contrast: 30, depth_capacity: 42,
  });
  assert.equal(selectColorIdentity(warmSoft).code, 'SSJ-02');
  assert.equal(selectColorIdentity(warmSoft).code, 'SSJ-02');
});

test('ranks two candidates and reports a bounded confidence assessment', () => {
  const ranked = rankColorIdentities(dimensions());
  const assessment = assessColorIdentity(dimensions());

  assert.equal(ranked.length, 16);
  assert.ok(ranked[0].distance <= ranked[1].distance);
  assert.equal(assessment.primary.code, ranked[0].code);
  assert.equal(assessment.secondary.code, ranked[1].code);
  assert.ok(['low', 'medium', 'high'].includes(assessment.level));
  assert.ok(assessment.margin >= 0);
  assert.match(assessment.message, new RegExp(assessment.primary.name));
});

test('overrides model identity and recommendations with knowledge-base content', () => {
  const dimensionData = dimensions({
    skin_temperature: 72, cheek_temperature: 72, lip_temperature: 72, hair_temperature: 72,
    skin_lightness: 70, brightness_capacity: 70, eye_depth: 30, hair_depth: 30,
    skin_clarity: 43, eye_clarity: 43, chroma_capacity: 43,
    skin_softness: 82, muted_capacity: 82, facial_contrast: 18,
    hair_skin_contrast: 30, depth_capacity: 42,
  });
  const result = applyIdentityKnowledge({
    identity_code: 'SSJ-16',
    season_name: '错误模型身份',
    season_en: 'Wrong',
    dimension_data: dimensionData,
    best_colors: [],
    avoid_colors: [],
  });
  assert.equal(result.identity_code, 'SSJ-02');
  assert.equal(result.season_name, '杏光柔暖');
  assert.equal(result.best_colors.length, 8);
  assert.equal(result.avoid_colors.length, 3);
  assert.equal(result.radar_data.length, 5);
  assert.equal(result.identity_assessment.primary.code, 'SSJ-02');
  assert.notEqual(result.identity_assessment.secondary.code, 'SSJ-02');
  assert.ok(result.identity_assessment.message);
});
