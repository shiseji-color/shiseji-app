import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('frontend uses versioned local assets instead of runtime CDNs', async () => {
  const [html, cssSource, appScript, packageJson] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  assert.match(html, /\.\/web\/app\.css/);
  assert.match(html, /\.\/web\/vendor\/html2canvas\.min\.js/);
  assert.match(html, /\.\/web\/vendor\/chart\.umd\.js/);
  assert.match(html, /\.\/web\/app\.js/);
  assert.doesNotMatch(html, /cdn\.tailwindcss|cdnjs\.cloudflare|cdn\.jsdelivr|fonts\.googleapis|transparenttextures/);
  assert.doesNotMatch(cssSource, /@import\s+url\(['"]?https?:|transparenttextures/);
  assert.ok(appScript.length > 10_000);
  assert.equal(packageJson.dependencies['chart.js'], '4.4.7');
  assert.equal(packageJson.dependencies.html2canvas, '1.4.1');
  assert.equal(packageJson.devDependencies.tailwindcss, '3.4.17');
});
test('frontend keeps the project-wide adaptive viewport baseline', async () => {
  const [html, cssSource, usageRules, privacyPolicy] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
    readFile(new URL('../usage-rules.html', import.meta.url), 'utf8'),
    readFile(new URL('../privacy-policy.html', import.meta.url), 'utf8'),
  ]);

  for (const page of [html, usageRules, privacyPolicy]) {
    assert.match(page, /viewport-fit=cover/);
  }
  assert.match(cssSource, /100dvh/);
  assert.match(cssSource, /safe-area-inset-top/);
  assert.match(cssSource, /@container \(max-width:340px\)/);
  assert.match(cssSource, /orientation:landscape/);
  assert.match(cssSource, /\.identity-preview \{ min-height:clamp\(/);
});

test('homepage preview communicates the report value instead of decorative metrics', async () => {
  const [html, cssSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../web/app.source.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /你的专属档案将呈现/);
  assert.match(html, /暖柔型/);
  assert.match(html, /示例结论/);
  assert.match(html, /本命色谱/);
  assert.match(html, /妆容建议/);
  assert.match(html, /穿搭方案/);
  assert.doesNotMatch(html, /暖柔倾向\s*<span>·<\/span>\s*中低对比/);
  assert.match(cssSource, /grid-template-columns: 1\.5fr repeat\(4, 1fr\)/);
  assert.match(cssSource, /\.preview-palette span:first-child/);
});
