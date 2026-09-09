import assert from 'node:assert/strict';
import test from 'node:test';
import { persistStyleImage } from '../lib/style-image-storage.js';

const job = {
  codeHash: 'a'.repeat(64),
  requestId: '11111111-1111-4111-a111-111111111111',
  kind: 'beauty',
};

test('rejects generated-image hosts outside the explicit allowlist before fetching', async () => {
  let called = false;
  await assert.rejects(
    persistStyleImage({
      ...job,
      sourceUrl: 'https://private.example/image.png',
      env: { STYLE_IMAGE_SOURCE_HOSTS: 'provider.example' },
      fetchImpl: async () => {
        called = true;
        throw new Error('must not fetch');
      },
    }),
    /source is not allowed/,
  );
  assert.equal(called, false);
});

test('does not follow a provider redirect to a non-allowlisted host', async () => {
  const requested = [];
  await assert.rejects(
    persistStyleImage({
      ...job,
      sourceUrl: 'https://cdn.provider.example/image.png',
      env: { STYLE_IMAGE_SOURCE_HOSTS: 'provider.example' },
      fetchImpl: async (url) => {
        requested.push(url);
        return new Response(null, {
          status: 302,
          headers: { location: 'https://127.0.0.1/secret' },
        });
      },
    }),
    /source is not allowed/,
  );
  assert.deepEqual(requested, ['https://cdn.provider.example/image.png']);
});

test('rejects an oversized image from content-length before reading its body', async () => {
  await assert.rejects(
    persistStyleImage({
      ...job,
      sourceUrl: 'https://cdn.provider.example/image.png',
      maxBytes: 10,
      env: { STYLE_IMAGE_SOURCE_HOSTS: 'provider.example' },
      fetchImpl: async () => new Response(new Uint8Array([1]), {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': '11' },
      }),
    }),
    /too large/,
  );
});
