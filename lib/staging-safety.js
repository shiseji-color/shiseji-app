const STAGING_PROJECT_REF = 'jzairzwgvkgbsizlamlv';
const PRODUCTION_PROJECT_REF = 'zaadhmvlgnciwjogmchl';

function parseSupabaseProjectRef(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('SUPABASE_URL 不是有效网址。');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('SUPABASE_URL 必须使用 HTTPS。');
  }

  const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(parsed.hostname);
  if (!match) {
    throw new Error('SUPABASE_URL 不是标准 Supabase 项目地址。');
  }

  return match[1].toLowerCase();
}

function assertStagingTarget(rawUrl) {
  const projectRef = parseSupabaseProjectRef(rawUrl);

  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error('安全拦截：检测到生产项目，已拒绝执行。');
  }

  if (projectRef !== STAGING_PROJECT_REF) {
    throw new Error(`安全拦截：仅允许 staging 项目 ${STAGING_PROJECT_REF}。`);
  }

  return projectRef;
}

module.exports = {
  STAGING_PROJECT_REF,
  PRODUCTION_PROJECT_REF,
  parseSupabaseProjectRef,
  assertStagingTarget,
};
