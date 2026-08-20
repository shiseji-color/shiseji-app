import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  analysisModelTimeout,
  BACKGROUND_MODEL_TIMEOUT_MS,
  INTERACTIVE_MODEL_TIMEOUT_MS,
} from '../api/analyze.js';
import { STYLE_IMAGE_PROVIDER_TIMEOUT_MS } from '../lib/style-image-provider.js';

test('Vercel fallback leaves API routes to serverless functions', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.functions['api/start-analysis.js'].maxDuration, 60);
  assert.equal(config.functions['api/analysis-worker.js'].maxDuration, 300);
  assert.deepEqual(config.functions['api/analysis-worker.js'].experimentalTriggers, [{
    type: 'queue/v2beta', topic: 'analysis-jobs', retryAfterSeconds: 120, initialDelaySeconds: 0,
  }]);
  assert.equal(config.functions['api/style-image-worker.js'].maxDuration, 300);
  assert.deepEqual(config.functions['api/style-image-worker.js'].experimentalTriggers, [{
    type: 'queue/v2beta', topic: 'style-image-jobs', retryAfterSeconds: 300, initialDelaySeconds: 0,
  }]);
  assert.equal(config.functions['api/*.js'].maxDuration, 30);
  assert.deepEqual(config.rewrites, [{
    source: '/((?!api/).*)',
    destination: '/index.html',
  }]);
});

test('analysis model timeouts leave cleanup time inside each Vercel function budget', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const workerBudgetMs = config.functions['api/analysis-worker.js'].maxDuration * 1_000;
  const interactiveBudgetMs = config.functions['api/*.js'].maxDuration * 1_000;

  assert.equal(analysisModelTimeout(true), BACKGROUND_MODEL_TIMEOUT_MS);
  assert.equal(analysisModelTimeout(false), INTERACTIVE_MODEL_TIMEOUT_MS);
  assert.equal(BACKGROUND_MODEL_TIMEOUT_MS, 240_000);
  assert.equal(INTERACTIVE_MODEL_TIMEOUT_MS, 25_000);
  assert.ok(BACKGROUND_MODEL_TIMEOUT_MS <= workerBudgetMs - 60_000);
  assert.ok(INTERACTIVE_MODEL_TIMEOUT_MS <= interactiveBudgetMs - 5_000);
});

test('style image provider timeout leaves checkpoint and storage time in the worker budget', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const workerBudgetMs = config.functions['api/style-image-worker.js'].maxDuration * 1_000;
  assert.equal(STYLE_IMAGE_PROVIDER_TIMEOUT_MS, 240_000);
  assert.ok(STYLE_IMAGE_PROVIDER_TIMEOUT_MS <= workerBudgetMs - 60_000);
});

test('style image recovery never retries an unknown synchronous submission', async () => {
  for (const relativePath of [
    '../database/activation-schema.sql',
    '../database/migrate-style-image-jobs.sql',
  ]) {
    const sql = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(sql, /when v_job\.stage = 'submitting' then 'style_image_submission_unknown'/);
    assert.match(sql, /v_job\.failure_code in \([\s\S]+style_image_model_rejected[\s\S]+or \(v_job\.failure_code = 'style_image_job_timeout' and v_job\.provider_task_id is not null\)/);
    assert.match(sql, /stage = 'provider_completed'[\s\S]+result_url = p_result_url/);
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
