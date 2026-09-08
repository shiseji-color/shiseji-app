import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGING_PROJECT_REF,
  parseSupabaseProjectRef,
  assertStagingTarget,
} from '../lib/staging-guard.js';

test('extracts a project ref from a standard Supabase URL', () => {
  assert.equal(
    parseSupabaseProjectRef(`https://${STAGING_PROJECT_REF}.supabase.co`),
    STAGING_PROJECT_REF,
  );
});

test('accepts only the approved staging project', () => {
  assert.equal(
    assertStagingTarget(`https://${STAGING_PROJECT_REF}.supabase.co`),
    STAGING_PROJECT_REF,
  );
});

test('explicitly blocks the production project', () => {
  assert.throws(
    () => assertStagingTarget('https://zaadhmvlgnciwjogmchl.supabase.co'),
    /生产项目/,
  );
});

test('blocks unknown projects and unsafe URLs', () => {
  assert.throws(
    () => assertStagingTarget('https://unknown.supabase.co'),
    /仅允许 staging/,
  );
  assert.throws(
    () => assertStagingTarget(`http://${STAGING_PROJECT_REF}.supabase.co`),
    /HTTPS/,
  );
  assert.throws(() => assertStagingTarget('not-a-url'), /有效网址/);
});
