import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('built redirect artifact routes every API before the SPA fallback', async () => {
  await import(`../scripts/build-static.js?routing-test=${Date.now()}`);
  const redirects = await readFile(new URL('../dist/_redirects', import.meta.url), 'utf8');
  const privacyPolicy = await readFile(new URL('../dist/privacy-policy.html', import.meta.url), 'utf8');
  assert.match(privacyPolicy, /隐私说明与删除申请/);
  assert.match(privacyPolicy, /默认 15 分钟有效的临时签名访问链接/);

  const rules = redirects.trim().split(/\r?\n/).map((line) => line.trim().split(/\s+/));

  assert.deepEqual(rules, [
    ['/api/verify-code', '/.netlify/functions/verify-code', '200'],
    ['/api/analyze', '/.netlify/functions/analyze', '200'],
    ['/api/analysis-status', '/.netlify/functions/analysis-status', '200'],
    ['/api/generate-style-image', '/.netlify/functions/generate-style-image', '200'],
    ['/*', '/index.html', '200'],
  ]);

  const statusRule = rules.findIndex(([from]) => from === '/api/analysis-status');
  const fallbackRule = rules.findIndex(([from]) => from === '/*');
  assert.ok(statusRule >= 0 && statusRule < fallbackRule);
});

test('netlify.toml also keeps all API rewrites before its SPA fallback', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');
  const fallback = config.indexOf('from = "/*"');
  for (const route of ['/api/verify-code', '/api/analyze', '/api/analysis-status', '/api/generate-style-image']) {
    const position = config.indexOf(`from = "${route}"`);
    assert.ok(position >= 0 && position < fallback, `${route} must precede SPA fallback`);
  }
});
