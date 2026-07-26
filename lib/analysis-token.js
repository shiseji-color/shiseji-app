import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_SECONDS = 10 * 60;

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
