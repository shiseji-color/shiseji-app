import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 10 * 60;
const VISUAL_TOKEN_TTL_SECONDS = 30 * 60;
const JOB_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const WORKER_TOKEN_TTL_SECONDS = 30 * 60;

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_TOKEN_SECRET must contain at least 32 characters');
  }
  return secret;
}

function encode(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(payload) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createAnalysisToken(codeHash, now = Date.now()) {
  const payload = encode(
    JSON.stringify({
      codeHash,
      exp: Math.floor(now / 1000) + TOKEN_TTL_SECONDS,
    }),
  );
  return `${payload}.${sign(payload)}`;
}

export function verifyAnalysisToken(token, now = Date.now()) {
  if (typeof token !== 'string') throw new Error('Analysis token is missing');
  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) {
    throw new Error('Analysis token is malformed');
  }

  const expected = Buffer.from(sign(payload));
  const supplied = Buffer.from(suppliedSignature);
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    throw new Error('Analysis token signature is invalid');
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (
    typeof data.codeHash !== 'string' ||
    !/^[0-9a-f]{64}$/.test(data.codeHash) ||
    !Number.isInteger(data.exp) ||
    data.exp < Math.floor(now / 1000)
  ) {
    throw new Error('Analysis token is expired or invalid');
  }

  return data.codeHash;
}

function analysisDigest(analysis) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) {
    throw new Error('INVALID_VISUAL_TOKEN');
  }

  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, canonicalize(value[key])]),
      );
    }
    return value;
  };

  return createHash('sha256')
    .update(JSON.stringify(canonicalize(analysis)), 'utf8')
    .digest('hex');
}

export function createVisualToken(codeHash, requestId, analysis, now = Date.now()) {
  const payload = encode(JSON.stringify({
    codeHash,
    rid: requestId,
    analysisHash: analysisDigest(analysis),
    type: 'visual',
    exp: Math.floor(now / 1000) + VISUAL_TOKEN_TTL_SECONDS
  }));

  return `${payload}.${sign(payload)}`;
}

export function verifyVisualToken(token, requestId, analysis, now = Date.now()) {
  if (typeof token !== 'string' || typeof requestId !== 'string') {
    throw new Error('INVALID_VISUAL_TOKEN');
  }

  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('INVALID_VISUAL_TOKEN');

  const [payload, signature] = parts;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('INVALID_VISUAL_TOKEN');
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('INVALID_VISUAL_TOKEN');
  }

  const nowSeconds = Math.floor(now / 1000);
  if (
    data?.type !== 'visual'
    || data?.rid !== requestId
    || !/^[0-9a-f]{64}$/.test(data?.codeHash || '')
    || data?.analysisHash !== analysisDigest(analysis)
    || !Number.isInteger(data?.exp)
    || data.exp <= nowSeconds
  ) {
    throw new Error('INVALID_VISUAL_TOKEN');
  }

  return { codeHash: data.codeHash, requestId: data.rid };
}

function createBoundToken(type, claims, now = Date.now()) {
  const ttl = type.endsWith('-worker') ? WORKER_TOKEN_TTL_SECONDS : JOB_TOKEN_TTL_SECONDS;
  const payload = encode(JSON.stringify({
    ...claims,
    type,
    exp: Math.floor(now / 1000) + ttl,
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyBoundToken(token, type, now = Date.now()) {
  if (typeof token !== 'string') throw new Error('INVALID_JOB_TOKEN');
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw new Error('INVALID_JOB_TOKEN');
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error('INVALID_JOB_TOKEN');
  }
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('INVALID_JOB_TOKEN');
  }
  if (
    data?.type !== type
    || !/^[0-9a-f]{64}$/.test(data?.codeHash || '')
    || !/^[0-9a-f-]{36}$/i.test(data?.requestId || '')
    || !/^[0-9a-f-]{36}$/i.test(data?.taskId || '')
    || !/^[0-9a-f-]{36}$/i.test(data?.ownerId || '')
    || !Number.isInteger(data?.exp)
    || data.exp <= Math.floor(now / 1000)
    || (type.endsWith('-worker') && !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/i.test(data?.photoPath || ''))
    || (type === 'style-worker' && !['beauty', 'outfit'].includes(data?.kind))
    || (type === 'style-worker' && (!data?.analysis || typeof data.analysis !== 'object' || Array.isArray(data.analysis)))
  ) throw new Error('INVALID_JOB_TOKEN');
  return data;
}

export const createAnalysisJobToken = (claims, now) => createBoundToken('analysis-status', claims, now);
export const verifyAnalysisJobToken = (token, now) => verifyBoundToken(token, 'analysis-status', now);
export const createAnalysisWorkerToken = (claims, now) => createBoundToken('analysis-worker', claims, now);
export const verifyAnalysisWorkerToken = (token, now) => verifyBoundToken(token, 'analysis-worker', now);
export const createStyleImageWorkerToken = (claims, now) => createBoundToken('style-worker', claims, now);
export const verifyStyleImageWorkerToken = (token, now) => verifyBoundToken(token, 'style-worker', now);
