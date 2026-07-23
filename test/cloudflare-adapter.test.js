import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptVercelHandlerForCloudflare } from '../lib/cloudflare-adapter.js';

test('adapts a Pages request to the existing API handler', async () => {
  const handler = adaptVercelHandlerForCloudflare((req, res) => {
    assert.equal(req.method, 'POST');
    assert.deepEqual(req.body, { activationCode: 'ABCD-123-XYZ' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ valid: true });
  });

  const response = await handler(
    new Request('https://example.pages.dev/api/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activationCode: 'ABCD-123-XYZ' }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { valid: true });
});

test('rejects malformed JSON before calling the API handler', async () => {
  const handler = adaptVercelHandlerForCloudflare(() => {
    throw new Error('handler should not be called');
  });

  const response = await handler(
    new Request('https://example.pages.dev/api/verify-code', {
      method: 'POST',
      body: '{',
    }),
  );

  assert.equal(response.status, 400);
});
