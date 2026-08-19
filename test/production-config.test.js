import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Vercel fallback leaves API routes to serverless functions', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.functions['api/start-analysis.js'].maxDuration, 60);
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
