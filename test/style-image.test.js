import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStyleImagePrompt,
  extractGeneratedImageUrl,
  extractStyleImageTaskId,
  normalizeStyleImageTaskStatus,
  validateStyleImageKind,
} from '../lib/style-image.js';

const analysis = {
  season_name: '柔光暖春',
  season_en: 'WARM · LIGHT · SOFT',
  best_colors: [{ name: '蜜桃珊瑚', hex: '#D9967C' }],
  makeup_advice: '蜜桃豆沙唇色与柔暖珊瑚腮红',
  outfit_advice: '燕麦针织搭配暖米半裙',
  accessory_advice: '香槟金与柔棕皮具',
  style_reference: '柔焦午后与天然织物',
};

test('builds identity-preserving beauty and outfit prompts', () => {
  const beauty = buildStyleImagePrompt('beauty', analysis);
  const outfit = buildStyleImagePrompt('outfit', analysis);
  assert.match(beauty, /保持她可被熟人一眼认出/);
  assert.match(beauty, /蜜桃豆沙唇色/);
  assert.match(outfit, /燕麦针织搭配暖米半裙/);
  assert.match(outfit, /香槟金与柔棕皮具/);
});

test('rejects unsupported style image kinds', () => {
  assert.throws(() => validateStyleImageKind('cover'));
});

test('extracts a generated HTTPS image URL', () => {
  const url = extractGeneratedImageUrl({
    output: { choices: [{ message: { content: [{ image: 'https://example.com/result.png' }] } }] },
  });
  assert.equal(url, 'https://example.com/result.png');
  assert.throws(() => extractGeneratedImageUrl({ output: {} }));
});

test('extracts async task identifiers and normalizes provider states', () => {
  assert.equal(extractStyleImageTaskId({ output: { task_id: 'task_12345678' } }), 'task_12345678');
  assert.equal(normalizeStyleImageTaskStatus({ output: { task_status: 'SUCCEEDED' } }), 'succeeded');
  assert.equal(normalizeStyleImageTaskStatus({ output: { task_status: 'unexpected' } }), 'unknown');
  assert.throws(() => extractStyleImageTaskId({ output: { task_id: '../unsafe' } }));
});
