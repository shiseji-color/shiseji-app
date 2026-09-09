import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { styleReferenceCatalog, selectStyleReference, STYLE_REFERENCE_PROFILE_MAP, selectProfileStyleReference } from '../lib/style-reference-catalog.js';

test('registered images exist with verified PNG dimensions and provenance', () => {
  assert.equal(new Set(styleReferenceCatalog.map(a => a.id)).size, 32);
  for (const asset of styleReferenceCatalog) {
    const png = readFileSync(new URL('../' + asset.path, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), asset.width);
    assert.equal(png.readUInt32BE(20), asset.height);
    assert.ok(existsSync(new URL('../' + asset.provenance, import.meta.url)));
    assert.ok(['SSJ-01', 'SSJ-02', 'SSJ-03', 'SSJ-04', 'SSJ-05', 'SSJ-06', 'SSJ-07', 'SSJ-08', 'SSJ-09', 'SSJ-10', 'SSJ-11', 'SSJ-12', 'SSJ-13', 'SSJ-14', 'SSJ-15', 'SSJ-16'].includes(asset.profileId));
    assert.equal(asset.canonicalName, {
      'SSJ-01': '晨露浅暖', 'SSJ-02': '杏光柔暖', 'SSJ-03': '日曜明暖', 'SSJ-05': '月纱浅冷',
      'SSJ-04': '琥珀深暖', 'SSJ-08': '暮蓝深冷',
      'SSJ-06': '雾蓝柔冷', 'SSJ-09': '珍珠浅净',
      'SSJ-10': '烟霞柔和', 'SSJ-15': '银雾静冷',
      'SSJ-07': '晶露明冷', 'SSJ-11': '琉璃清透',
      'SSJ-12': '墨曜高对比', 'SSJ-13': '蜜桃明柔',
      'SSJ-14': '岩茶稳暖', 'SSJ-16': '星夜锐冷',
    }[asset.profileId]);
    assert.equal(asset.userPhotoUsed, false);
    assert.equal(asset.status, 'released');
    assert.match(asset.notice, /AI.*非本人/);
    assert.ok(Object.isFrozen(asset));
  }
});

test('all 32 profile-use slots are explicit and missing slots do not borrow images', () => {
  assert.equal(Object.keys(STYLE_REFERENCE_PROFILE_MAP).length, 16);
  for (const [profileId, slots] of Object.entries(STYLE_REFERENCE_PROFILE_MAP)) {
    assert.deepEqual(Object.keys(slots), ['beauty', 'outfit']);
    assert.ok(Object.isFrozen(slots));
    for (const kind of ['beauty', 'outfit']) {
      const selected = selectProfileStyleReference({ profileId, kind, scope: 'staging' });
      assert.equal(Boolean(selected.asset), ['SSJ-01', 'SSJ-02', 'SSJ-03', 'SSJ-04', 'SSJ-05', 'SSJ-06', 'SSJ-07', 'SSJ-08', 'SSJ-09', 'SSJ-10', 'SSJ-11', 'SSJ-12', 'SSJ-13', 'SSJ-14', 'SSJ-15', 'SSJ-16'].includes(profileId));
      if (selected.asset) assert.equal(selected.asset.profileId, profileId);
      else assert.equal(selected.reason, 'missing-exact-match');
    }
  }
  assert.equal(selectProfileStyleReference({ profileId: 'warm-spring', kind: 'beauty', scope: 'staging' }).reason, 'unknown-profile');
  assert.equal(selectProfileStyleReference({ profileId: 'SSJ-02', kind: 'beauty', scope: 'production' }).asset.profileId, 'SSJ-02');
});

test('only exact local sample and image kind can select a candidate', () => {
  for (const kind of ['beauty', 'outfit']) {
    const result = selectStyleReference({ sampleKey: 'warm-spring', kind, scope: 'local-preview' });
    assert.equal(result.asset.kind, kind);
    assert.equal(result.reason, null);
  }
  assert.equal(selectStyleReference({ sampleKey: 'SSJ-02', kind: 'beauty', scope: 'local-preview' }).reason, 'missing-exact-match');
  assert.equal(selectStyleReference({ sampleKey: 'cool-winter', kind: 'beauty', scope: 'local-preview' }).asset, null);
  assert.equal(selectStyleReference({ sampleKey: 'warm-spring', kind: 'hair', scope: 'local-preview' }).reason, 'unsupported-kind');
});

test('local preview lookup remains isolated from report scopes', () => {
  assert.equal(selectStyleReference().asset, null);
  for (const scope of [undefined, 'production', 'staging']) {
    assert.equal(selectStyleReference({ sampleKey: 'warm-spring', kind: 'beauty', scope }).reason, 'not-released');
  }
});
