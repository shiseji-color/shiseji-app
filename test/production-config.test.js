import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vercel fallback leaves API routes to serverless functions', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.functions['api/start-analysis.js'].maxDuration, 60);
  assert.equal(config.functions['api/analysis-worker.js'].maxDuration, 300);
  assert.deepEqual(config.functions['api/analysis-worker.js'].experimentalTriggers, [{
    type: 'queue/v2beta', topic: 'analysis-jobs', retryAfterSeconds: 120, initialDelaySeconds: 0,
  }]);
  assert.equal(config.functions['api/*.js'].maxDuration, 30);
  assert.deepEqual(config.rewrites, [{
    source: '/((?!api/).*)',
    destination: '/index.html',
  }]);
});

test('style image timeout retries preserve a paid provider task ID', async () => {
  for (const relativePath of [
    '../database/activation-schema.sql',
    '../database/migrate-style-image-jobs.sql',
  ]) {
    const sql = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(sql, /failure_code = 'style_image_job_timeout' and provider_task_id is not null[\s\S]+then 'processing'/);
    assert.match(sql, /when failure_code = 'style_image_job_timeout' then provider_task_id/);
  }
});

test('style image rollback refuses to discard jobs or stored images', async () => {
  const sql = await readFile(
    new URL('../database/rollback-style-image-jobs.sql', import.meta.url),
    'utf8',
  );

  assert.match(sql, /if exists \(select 1 from public\.style_image_jobs\)/);
  assert.match(sql, /if exists \([\s\S]+from storage\.objects where bucket_id = 'style-images'/);
  assert.match(sql, /raise exception 'rollback refused: style_image_jobs contains data'/);
  assert.match(sql, /raise exception 'rollback refused: style-images contains objects'/);
  assert.match(sql, /create function public\.claim_style_image_job\([\s\S]+p_owner_id uuid[\s\S]+returns table \(job_status text, result_url text\)/);
});
