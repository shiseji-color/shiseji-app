import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import postgres from 'postgres';
import { assertStagingTarget } from '../lib/staging-guard.js';

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const password = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !password) {
  throw new Error('缺少 staging SUPABASE_URL 或数据库密码。');
}

const projectRef = assertStagingTarget(supabaseUrl);
const host = process.env.SUPABASE_DB_HOST?.trim() || `db.${projectRef}.supabase.co`;
const user = process.env.SUPABASE_DB_USER?.trim() || 'postgres';
const port = Number(process.env.SUPABASE_DB_PORT || 5432);

const sql = postgres({
  host,
  port,
  database: 'postgres',
  username: user,
  password,
  ssl: 'require',
  max: 1,
  prepare: false,
  connect_timeout: 15,
});

const migrationFiles = [
  'database/activation-schema.sql',
  'database/migrate-analysis-jobs.sql',
  'database/migrate-style-image-jobs.sql',
];

function requireRows(actual, expected, label) {
  const actualSet = new Set(actual);
  const missing = expected.filter((item) => !actualSet.has(item));
  if (missing.length) {
    throw new Error(`${label} 验证失败，缺少：${missing.join(', ')}`);
  }
}

try {
  console.log(`安全检查通过：仅连接 staging ${projectRef}`);

  for (const file of migrationFiles) {
    console.log(`执行迁移：${file}`);
    const source = await readFile(file, 'utf8');
    await sql.unsafe(source);
  }

  const tables = await sql`
    select tablename
    from pg_tables
    where schemaname = 'public'
      and tablename in (
        'activation_codes',
        'activation_usage_events',
        'analysis_jobs',
        'style_image_jobs'
      )
  `;
  requireRows(
    tables.map((row) => row.tablename),
    ['activation_codes', 'activation_usage_events', 'analysis_jobs', 'style_image_jobs'],
    '数据表',
  );

  const rlsTables = await sql`
    select relname
    from pg_class
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and relname in (
        'activation_codes',
        'activation_usage_events',
        'analysis_jobs',
        'style_image_jobs'
      )
      and relrowsecurity
      and relforcerowsecurity
  `;
  requireRows(
    rlsTables.map((row) => row.relname),
    ['activation_codes', 'activation_usage_events', 'analysis_jobs', 'style_image_jobs'],
    'RLS',
  );

  const buckets = await sql`
    select id
    from storage.buckets
    where id in ('analysis-temp', 'style-images') and public = false
  `;
  requireRows(
    buckets.map((row) => row.id),
    ['analysis-temp', 'style-images'],
    '私有存储桶',
  );

  const exposed = await sql`
    select table_name, grantee
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in (
        'activation_codes',
        'activation_usage_events',
        'analysis_jobs',
        'style_image_jobs'
      )
      and grantee in ('anon', 'authenticated')
      and privilege_type = 'SELECT'
  `;
  if (exposed.length) {
    throw new Error('权限验证失败：发现 anon/authenticated 可读取内部表。');
  }

  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = randomBytes(8);
  const suffix = Array.from(random, (value) => alphabet[value % alphabet.length]).join('');
  const testCode = `STG-${suffix}`;
  const codeHash = createHash('sha256').update(testCode, 'utf8').digest('hex');

  await sql`
    insert into public.activation_codes (
      code_hash, remaining_uses, total_uses, enabled
    ) values (${codeHash}, 3, 3, true)
    on conflict (code_hash) do nothing
  `;

  await mkdir('private', { recursive: true });
  await writeFile(
    'private/test-activation-code.txt',
    [
      '拾色季 staging 测试激活码',
      testCode,
      '可用次数：3',
      '仅用于 staging，请勿公开或提交到 Git。',
      '',
    ].join('\r\n'),
    'utf8',
  );

  console.log('staging 数据库迁移、安全验证和 3 次测试码创建全部完成。');
  console.log('测试码仅保存在 private/test-activation-code.txt。');
} finally {
  await sql.end({ timeout: 5 });
}
