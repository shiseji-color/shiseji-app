import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 10 * 60;
const VISUAL_TOKEN_TTL_SECONDS = 30 * 60;

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
  return createHash('sha256').update(JSON.stringify(analysis), 'utf8').digest('hex');
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
