import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptVercelHandler } from '../lib/netlify-adapter.js';

process.env.API_KEY ||= 'test-api-key';
process.env.BASE_URL ||= 'https://example.invalid/v1';
process.env.AUTH_TOKEN_SECRET ||= 'test-secret-with-at-least-thirty-two-characters';

const getEvent = {
  httpMethod: 'GET',
  headers: {},
  body: null,
};

test('adapts direct handlers and default-export module objects', async () => {
  const vercelHandler = (_request, response) => (
    response.status(405).json({ error: 'method not allowed' })
  );

  const direct = await adaptVercelHandler(vercelHandler)(getEvent);
  const wrapped = await adaptVercelHandler({ default: vercelHandler })(getEvent);

  assert.equal(direct.statusCode, 405);
  assert.equal(wrapped.statusCode, 405);
});

test('returns a clear server error when no handler can be resolved', async () => {
  const response = await adaptVercelHandler({ default: {} })(getEvent);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(JSON.parse(response.body), {
    error: '服务器函数配置错误，请联系管理员',
  });
});

for (const entry of [
  '../netlify/functions/verify-code.js',
  '../netlify/functions/analyze.js',
  '../netlify/functions/analysis-status.js',
  '../netlify/functions/generate-style-image.js',
]) {
  test(`Netlify entry ${entry} returns 405 for GET`, async () => {
    const module = await import(entry);
    assert.equal(typeof module.handler, 'function');

    const response = await module.handler(getEvent);
    assert.equal(response.statusCode, 405);
    assert.doesNotMatch(response.body, /vercelHandler is not a function/);
  });
}

test('Netlify exports a background style image worker', async () => {
  const module = await import('../netlify/functions/style-image-background.js');
  assert.equal(typeof module.handler, 'function');
});
