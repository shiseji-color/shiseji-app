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
  assert.deepEqual(config.headers, [{
    source: '/(.*)',
    headers: [
      { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' https://*.supabase.co data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
    ],
  }]);
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
  assert.match(sql, /drop function if exists public\.save_style_image_source\(text, uuid, text, uuid, text\)/);
  assert.match(sql, /drop function if exists public\.save_style_image_provider_result\(text, uuid, text, uuid, text\)/);
  assert.match(sql, /drop constraint if exists style_image_jobs_source_path_valid/);
  assert.match(sql, /drop column if exists source_path/);
});

test('style image migration verification covers every new RPC and constraint', async () => {
  const sql = await readFile(
    new URL('../database/verify-style-image-migration.sql', import.meta.url),
    'utf8',
  );
  for (const rpc of [
    'claim_style_image_job',
    'begin_style_image_provider_submission',
    'save_style_image_provider_task',
    'save_style_image_source',
    'save_style_image_provider_result',
    'complete_style_image_job',
    'fail_style_image_job',
  ]) {
    assert.match(sql, new RegExp(rpc));
  }
  assert.match(sql, /all_job_constraints_valid/);
  assert.match(sql, /= 9 as all_job_constraints_valid/);
});

test('CI includes dependency, CodeQL, and production dependency audit gates', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  assert.match(workflow, /npm audit --omit=dev --audit-level=high/);
  assert.match(workflow, /actions\/dependency-review-action@[0-9a-f]{40}/);
  assert.match(workflow, /github\/codeql-action\/init@[0-9a-f]{40}/);
  assert.match(workflow, /github\/codeql-action\/analyze@[0-9a-f]{40}/);
  assert.doesNotMatch(workflow, /^\s*- uses: [^\s]+@v\d+\s*$/m);
});
test('production safety defaults and logs fail closed', async () => {
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(envExample, /^STYLE_IMAGE_GENERATION_ENABLED=false$/m);

  const activationStore = await readFile(new URL('../lib/activation-store.js', import.meta.url), 'utf8');
  assert.doesNotMatch(activationStore, /response\.text\(\)/);

  const safeLogs = [
    ['../api/verify-code.js', /activation_store_unavailable/, /console\.error\([^\n]+, error\)/],
    ['../api/start-analysis.js', /analysis_enqueue_failed/, /error\?\.message/],
    ['../lib/netlify-adapter.js', /handler_rejected/, /console\.error\([^\n]+, error\)/],
  ];
  for (const [relativePath, safeCode, unsafePattern] of safeLogs) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(source, safeCode);
    assert.doesNotMatch(source, unsafePattern);
  }
});

test('Netlify and Vercel publish the same trusted security headers', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const netlify = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  for (const { key, value } of config.headers[0].headers) {
    assert.match(netlify, new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} = "${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }
  assert.match(netlify, /img-src 'self' https:\/\/\*\.supabase\.co data: blob:/);
});
