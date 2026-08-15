import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import startAnalysis, { buildBackgroundPayload } from '../api/start-analysis.js';
import analysisStatus from '../api/analysis-status.js';
import { createAnalysisToken } from '../lib/analysis-token.js';
import { deleteTemporaryPhoto, uploadTemporaryPhoto } from '../lib/temporary-photo-store.js';
import { processBackgroundAnalysis } from '../lib/analysis-job-worker.js';

const original = {
  fetch: global.fetch, secret: process.env.AUTH_TOKEN_SECRET,
  url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY,
  deploy: process.env.DEPLOY_PRIME_URL,
};
process.env.AUTH_TOKEN_SECRET = 'test-secret-with-at-least-thirty-two-characters';
process.env.SUPABASE_URL = 'https://storage.invalid';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
process.env.DEPLOY_PRIME_URL = 'https://deploy.invalid';

test.after(() => {
  global.fetch = original.fetch;
  for (const [name, value] of [['AUTH_TOKEN_SECRET', original.secret], ['SUPABASE_URL', original.url], ['SUPABASE_SECRET_KEY', original.key], ['DEPLOY_PRIME_URL', original.deploy]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

function responseCapture() {
  const output = { statusCode: 200, headers: {} };
  const res = {
    setHeader(name, value) { output.headers[name] = value; },
    status(code) { output.statusCode = code; return res; },
    json(body) { output.body = body; return res; },
  };
  return { output, res };
}

test('a photo larger than 256 KB is stored privately and never enters the background payload', async () => {
  const photoBytes = Buffer.alloc(300_000, 7);
  const imageBase64 = `data:image/jpeg;base64,${photoBytes.toString('base64')}`;
  const requestId = 'c9a6464f-65ef-4d3e-a9f7-d7e1b443d586';
  let uploadedBytes = 0;
  let backgroundBody = '';
  global.fetch = async (url, options = {}) => {
    if (String(url).includes('claim_expired_analysis_photos')) return Response.json([]);
    if (String(url).includes('create_analysis_job')) {
      const body = JSON.parse(options.body);
      return Response.json([{ task_id: body.p_task_id, owner_id: body.p_owner_id, photo_path: body.p_photo_path, job_status: 'queued', created: true }]);
    }
    if (String(url).includes('/storage/v1/object/analysis-temp/')) {
      uploadedBytes = options.body.length;
      assert.equal(String(url).includes('?'), false);
      return Response.json({ Key: 'private' });
    }
    if (String(url).includes('analyze-background')) {
      backgroundBody = options.body;
      return new Response(null, { status: 202 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  const { output, res } = responseCapture();
  await startAnalysis({ method: 'POST', headers: { host: 'deploy.invalid' }, body: {
    imageBase64, analysisToken: createAnalysisToken('a'.repeat(64)), requestId,
  } }, res);
  assert.equal(output.statusCode, 202);
  assert.equal(uploadedBytes, photoBytes.length);
  assert.ok(Buffer.byteLength(backgroundBody) < 256 * 1024);
  assert.equal(backgroundBody.includes('imageBase64'), false);
  assert.equal(backgroundBody.includes(photoBytes.toString('base64').slice(0, 100)), false);
});

test('status flow exposes queued, processing, then completed without exposing a photo path', async () => {
  const claims = { codeHash: 'b'.repeat(64), requestId: 'c9a6464f-65ef-4d3e-a9f7-d7e1b443d586', taskId: '19d77534-63ee-4db0-af9a-554c7d49ef33', ownerId: '25250509-5bb4-4664-a601-a850360bed60' };
  const { createAnalysisJobToken } = await import('../lib/analysis-token.js');
  const jobToken = createAnalysisJobToken(claims);
  const states = ['queued', 'processing', 'completed'];
  global.fetch = async () => Response.json([{ job_status: states.shift(), result: { season_en: 'Autumn' }, visual_token: 'visual', remaining_uses: 4, photo_path: 'secret/path.jpg' }]);
  for (const expected of ['queued', 'processing', 'completed']) {
    const { output, res } = responseCapture();
    await analysisStatus({ method: 'POST', headers: {}, body: { taskId: claims.taskId, jobToken } }, res);
    assert.equal(output.body.status, expected);
    assert.equal('photoPath' in output.body, false);
  }
});

test('temporary photos are deleted through the private Storage API after success or failure cleanup', async () => {
  const calls = [];
  global.fetch = async (url, options) => { calls.push({ url: String(url), method: options.method, body: options.body }); return Response.json({}); };
  await uploadTemporaryPhoto('task/owner.jpg', { bytes: Buffer.from('photo'), contentType: 'image/jpeg' });
  await deleteTemporaryPhoto('task/owner.jpg');
  await deleteTemporaryPhoto('task/owner.jpg');
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'DELETE', 'POST', 'DELETE', 'POST']);
  assert.equal(calls.some((call) => call.url.includes('/public/')), false);
});

test('background worker cleans the private photo after both completion and explicit failure', async () => {
  for (const shouldFail of [false, true]) {
    let cleanups = 0;
    let status = 'queued';
    const outcome = await processBackgroundAnalysis({
      claim: async () => { status = 'processing'; return 'claimed'; },
      analyze: async () => { if (shouldFail) throw new Error('model failed'); return { ok: true }; },
      complete: async () => { status = 'completed'; return { completed: true }; },
      fail: async () => { status = 'failed'; },
      cleanup: async () => { cleanups += 1; },
    });
    assert.equal(outcome.status, shouldFail ? 'failed' : 'completed');
    assert.equal(status, shouldFail ? 'failed' : 'completed');
    assert.equal(cleanups, 1);
  }
});

test('completion locks and validates processing before touching activation usage', async () => {
  const sql = await readFile(new URL('../database/migrate-analysis-jobs.sql', import.meta.url), 'utf8');
  const functionBody = sql.slice(sql.indexOf('create or replace function public.complete_analysis_job'), sql.indexOf('create or replace function public.fail_analysis_job'));
  const jobLock = functionBody.indexOf('for update;');
  const statusGuard = functionBody.indexOf("v_job.status <> 'processing'");
  const activationWrite = functionBody.indexOf('update public.activation_codes');
  assert.ok(jobLock >= 0 && statusGuard > jobLock && activationWrite > statusGuard);
  assert.match(functionBody, /insert into public\.activation_usage_events[\s\S]+update public\.analysis_jobs set status='completed'/);
});

test('background payload builder has a hard limit and contains no photo bytes', () => {
  const body = buildBackgroundPayload({ codeHash: 'c'.repeat(64), requestId: 'c9a6464f-65ef-4d3e-a9f7-d7e1b443d586', taskId: '19d77534-63ee-4db0-af9a-554c7d49ef33', ownerId: '25250509-5bb4-4664-a601-a850360bed60', photoPath: '19d77534-63ee-4db0-af9a-554c7d49ef33/25250509-5bb4-4664-a601-a850360bed60.jpg' });
  assert.ok(Buffer.byteLength(body) < 200_000);
  assert.deepEqual(Object.keys(JSON.parse(body)), ['workerToken']);
});

test('a different task ID cannot read task state or a temporary photo', async () => {
  const { createAnalysisJobToken } = await import('../lib/analysis-token.js');
  const claims = { codeHash: 'd'.repeat(64), requestId: 'c9a6464f-65ef-4d3e-a9f7-d7e1b443d586', taskId: '19d77534-63ee-4db0-af9a-554c7d49ef33', ownerId: '25250509-5bb4-4664-a601-a850360bed60' };
  let fetched = false;
  global.fetch = async () => { fetched = true; throw new Error('must not fetch'); };
  const { output, res } = responseCapture();
  await analysisStatus({ method: 'POST', headers: {}, body: {
    taskId: '11111111-1111-4111-8111-111111111111', jobToken: createAnalysisJobToken(claims),
  } }, res);
  assert.equal(output.statusCode, 403);
  assert.equal(fetched, false);
  assert.equal('photoPath' in output.body, false);
});
