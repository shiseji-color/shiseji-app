import { getSupabaseConfig } from './activation-store.js';

const STYLE_IMAGE_BUCKET = 'style-images';
const SUPPORTED_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);

const DEFAULT_SOURCE_HOST_SUFFIXES = ['aliyuncs.com'];

function storageHeaders(key, extra = {}) {
  const headers = { apikey: key, ...extra };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return headers;
}

function safePathPart(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

function sourceHostSuffixes(env = process.env) {
  const configured = String(env.STYLE_IMAGE_SOURCE_HOSTS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_SOURCE_HOST_SUFFIXES;
}

function assertSafeSourceUrl(value, env = process.env) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Generated image URL is invalid');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) {
    throw new Error('Generated image URL is invalid');
  }
  const hostname = parsed.hostname.toLowerCase();
  const allowed = sourceHostSuffixes(env).some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  );
  if (!allowed) throw new Error('Generated image source is not allowed');
  return parsed.href;
}

async function fetchSafeSource(sourceUrl, fetchImpl, env) {
  let currentUrl = assertSafeSourceUrl(sourceUrl, env);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetchImpl(currentUrl, { redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || redirects === 3) throw new Error('Generated image redirect is invalid');
    currentUrl = assertSafeSourceUrl(new URL(location, currentUrl).href, env);
  }
  throw new Error('Generated image redirect is invalid');
}

async function readBoundedBytes(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error('Generated image is too large');
  }
  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.byteLength || bytes.byteLength > maxBytes) {
      throw new Error('Generated image is empty or too large');
    }
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Generated image is too large');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new Error('Generated image is empty');
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function persistStyleImage({
  sourceUrl,
  codeHash,
  requestId,
  kind,
  maxBytes = 5_500_000,
  fetchImpl = globalThis.fetch,
  env = process.env,
}) {
  const source = await fetchSafeSource(sourceUrl, fetchImpl, env);
  if (!source.ok) throw new Error('Generated image download failed');
  const contentType = (source.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extension = SUPPORTED_IMAGE_TYPES.get(contentType);
  if (!extension) throw new Error('Generated image type is unsupported');
  const bytes = await readBoundedBytes(source, maxBytes);

  const { url, key } = getSupabaseConfig();
  const path = `${safePathPart(codeHash)}/${safePathPart(requestId)}/${safePathPart(kind)}.${extension}`;
  const upload = await fetchImpl(
    `${url}/storage/v1/object/${STYLE_IMAGE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: storageHeaders(key, {
        'Content-Type': contentType,
        'x-upsert': 'true',
      }),
      body: bytes,
    },
  );
  if (!upload.ok) throw new Error('Generated image persistence failed');
  return path;
}

export async function createStyleImageSignedUrl(
  path,
  expiresIn = 900,
  fetchImpl = globalThis.fetch,
) {
  if (typeof path !== 'string'
    || !/^[a-fA-F0-9]{32,128}\/[a-fA-F0-9-]{36}\/(?:beauty|outfit)\.(?:png|jpg|webp)$/.test(path)) {
    throw new Error('Generated image path is invalid');
  }
  const { url, key } = getSupabaseConfig();
  const response = await fetchImpl(
    `${url}/storage/v1/object/sign/${STYLE_IMAGE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: storageHeaders(key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn }),
    },
  );
  if (!response.ok) throw new Error('Generated image signing failed');
  const payload = await response.json();
  const signedPath = payload.signedURL || payload.signedUrl;
  if (!signedPath) throw new Error('Generated image signing returned no URL');
  return signedPath.startsWith('http') ? signedPath : `${url}/storage/v1${signedPath}`;
}
