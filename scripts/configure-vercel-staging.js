import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';

import { assertStagingTarget } from '../lib/staging-guard.js';

loadEnvFile('.env.staging.local');
assertStagingTarget(process.env.SUPABASE_URL);

const project = JSON.parse(await readFile('.vercel/project.json', 'utf8'));
if (project.projectName !== 'shiseji-staging') {
  throw new Error('安全拦截：当前 Vercel 项目不是 shiseji-staging。');
}

const variables = [
  ['SUPABASE_URL', false],
  ['SUPABASE_SECRET_KEY', true],
  ['API_KEY', true],
  ['BASE_URL', false],
  ['MODEL_NAME', false],
  ['IMAGE_BASE_URL', false],
  ['IMAGE_MODEL_NAME', false],
  ['STYLE_IMAGE_SOURCE_HOSTS', false],
  ['STYLE_IMAGE_GENERATION_ENABLED', false],
  ['AUTH_TOKEN_SECRET', true],
];

if (process.env.STYLE_IMAGE_GENERATION_ENABLED !== 'false') {
  throw new Error('安全拦截：staging 造型图生成开关必须关闭。');
}

for (const [name, sensitive] of variables) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`预发布变量 ${name} 未配置。`);
  const result = spawnSync('npx.cmd', [
    '--yes',
    'vercel@latest',
    'env',
    'add',
    name,
    'preview',
    sensitive ? '--sensitive' : '--no-sensitive',
    '--force',
    '--yes',
    '--scope',
    'shiseji-colors-projects',
  ], {
    input: `${value}\n`,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`Vercel Preview 变量 ${name} 配置失败。`);
  }
  console.log(`Configured Preview variable: ${name}`);
}

console.log('Vercel staging Preview environment configured safely.');
