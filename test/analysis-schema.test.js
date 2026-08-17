import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAnalysisResult } from '../lib/analysis-schema.js';
import {
  applyIdentityKnowledge,
  COLOR_DIMENSION_OPTIONS,
} from '../lib/color-framework.js';

function validResult() {
  return {
    identity_code: 'SSJ-06',
    season_name: '雾蓝柔冷',
    season_en: 'Misty Blue',
    description: '整体色彩柔和。',
    style_keywords: ['柔和', '清透', '低对比'],
    color_impression: '像薄雾花园般安静柔和。',
    feature_colors: [
      { label: '肌肤底色', hex: '#AABBCC' },
      { label: '面颊色调', hex: '#DDBBCC' },
      { label: '原生发色', hex: '#332E31' },
      { label: '瞳孔特征', hex: '#403A3B' },
    ],
    radar_data: [
      { name: '冷暖', value: 60 },
      { name: '明度', value: 70 },
      { name: '纯度', value: 40 },
      { name: '柔和度', value: 80 },
      { name: '对比度', value: 35 },
    ],
    dimension_data: COLOR_DIMENSION_OPTIONS.map(({ key, name }, index) => ({
      key,
      name,
      value: 40 + index,
      observation: `${name}观察结果`,
    })),
    best_colors: Array.from({ length: 8 }, (_, index) => ({
      name: `推荐色${index + 1}`,
      hex: '#778899',
    })),
    makeup_advice: '使用柔和色彩。',
    outfit_advice: '低对比穿搭。',
    accessory_advice: '哑光银饰。',
    style_reference: '薄雾清晨、哑光银饰与轻柔针织的安静气质。',
    avoid_colors: ['荧光橙', '亮橘红', '冷黑色'],
  };
}

test('normalizes and accepts a bounded analysis response', () => {
  const result = validateAnalysisResult(validResult());
  assert.equal(result.feature_colors[0].hex, '#AABBCC');
  assert.deepEqual(result.radar_data, []);
  assert.deepEqual(result.style_keywords, []);
  assert.equal(result.color_impression, '像薄雾花园般安静柔和。');
});

test('requires the model-owned narrative layer', () => {
  const missingImpression = validResult();
  delete missingImpression.color_impression;
  assert.throws(() => validateAnalysisResult(missingImpression), /color_impression/);
});

test('rejects unsafe model-owned color values', () => {
  const invalidColor = validResult();
  invalidColor.feature_colors[0].hex = 'red; background:url(x)';
  assert.throws(() => validateAnalysisResult(invalidColor), /feature_colors/);
});

test('rejects missing required fields and oversized arrays', () => {
  const missing = validResult();
  delete missing.description;
  assert.throws(() => validateAnalysisResult(missing), /description/);

  const incomplete = validResult();
  incomplete.feature_colors.pop();
  assert.throws(() => validateAnalysisResult(incomplete), /exactly 4/);
});

test('rejects reordered dimensions', () => {
  const reorderedDimensions = validResult();
  [reorderedDimensions.dimension_data[0], reorderedDimensions.dimension_data[1]] = [
    reorderedDimensions.dimension_data[1],
    reorderedDimensions.dimension_data[0],
  ];
  assert.throws(() => validateAnalysisResult(reorderedDimensions), /key must be/);
});

test('accepts only the observation fields owned by the model', () => {
  const full = validResult();
  const result = validateAnalysisResult({
    description: full.description,
    color_impression: full.color_impression,
    feature_colors: full.feature_colors,
    dimension_data: full.dimension_data,
  });

  assert.equal(result.identity_code, '');
  assert.deepEqual(result.best_colors, []);
  assert.deepEqual(result.avoid_colors, []);
  assert.equal(result.dimension_data.length, 16);
});

test('server knowledge completes the report after observation validation', () => {
  const full = validResult();
  const observed = validateAnalysisResult({
    description: full.description,
    color_impression: full.color_impression,
    feature_colors: full.feature_colors,
    dimension_data: full.dimension_data,
  });
  const completed = applyIdentityKnowledge(observed);

  assert.match(completed.identity_code, /^SSJ-\d{2}$/);
  assert.equal(completed.style_keywords.length, 3);
  assert.equal(completed.radar_data.length, 5);
  assert.equal(completed.best_colors.length, 8);
  assert.equal(completed.avoid_colors.length, 3);
});

test('accepts a photo rejection without synthetic report fields', () => {
  const result = validateAnalysisResult({
    season_name: '无法完成诊断',
    season_en: 'PHOTO_NOT_ELIGIBLE',
    description: '请上传自然光下的清晰正面照片。',
  });
  assert.equal(result.identity_code, 'PHOTO_NOT_ELIGIBLE');
  assert.deepEqual(result.dimension_data, []);
});
