import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAnalysisResult } from '../lib/analysis-schema.js';

function validResult() {
  return {
    season_name: '柔夏型',
    season_en: 'Soft Summer',
    description: '整体色彩柔和。',
    style_keywords: ['柔和', '清透', '低对比'],
    color_impression: '像薄雾花园般安静柔和。',
    feature_colors: [{ label: '肌肤底色', hex: '#AABBCC' }],
    radar_data: [{ name: '冷暖', value: 60 }],
    best_colors: [{ name: '雾霾蓝', hex: '#778899' }],
    makeup_advice: '使用柔和色彩。',
    outfit_advice: '低对比穿搭。',
    accessory_advice: '哑光银饰。',
    celebrity_reference: '仅供风格参考。',
    avoid_colors: ['荧光橙'],
  };
}

test('normalizes and accepts a bounded analysis response', () => {
  const result = validateAnalysisResult(validResult());
  assert.equal(result.feature_colors[0].hex, '#AABBCC');
  assert.equal(result.radar_data[0].value, 60);
  assert.deepEqual(result.style_keywords, ['柔和', '清透', '低对比']);
  assert.equal(result.color_impression, '像薄雾花园般安静柔和。');
});

test('keeps identity fields backward compatible', () => {
  const legacy = validResult();
  delete legacy.style_keywords;
  delete legacy.color_impression;
  const result = validateAnalysisResult(legacy);
  assert.deepEqual(result.style_keywords, []);
  assert.equal(result.color_impression, '');
});

test('rejects unsafe color values and out-of-range radar values', () => {
  const invalidColor = validResult();
  invalidColor.best_colors[0].hex = 'red; background:url(x)';
  assert.throws(() => validateAnalysisResult(invalidColor), /best_colors/);

  const invalidRadar = validResult();
  invalidRadar.radar_data[0].value = 101;
  assert.throws(() => validateAnalysisResult(invalidRadar), /value is invalid/);
});

test('rejects missing required fields and oversized arrays', () => {
  const missing = validResult();
  delete missing.season_name;
  assert.throws(() => validateAnalysisResult(missing), /season_name/);

  const oversized = validResult();
  oversized.best_colors = Array.from({ length: 17 }, () => ({
    name: '颜色',
    hex: '#112233',
  }));
  assert.throws(() => validateAnalysisResult(oversized), /bounded array/);
});
