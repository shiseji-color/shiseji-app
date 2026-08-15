const BUCKET = 'analysis-temp';
const MAX_IMAGE_BYTES = 3_000_000;

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server environment variables are missing');
  return { url, key };
}

function headers(contentType) {
  const { key } = config();
  const result = {
    apikey: key,
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
  if (key.startsWith('eyJ')) result.Authorization = `Bearer ${key}`;
  return result;
}

function objectUrl(path) {
  const { url } = config();
  return `${url}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function decodePhotoDataUrl(value) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value || '');
  if (!match) throw new Error('INVALID_PHOTO');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('PHOTO_TOO_LARGE');
  return { bytes, contentType: match[1] };
}

export function temporaryPhotoPath(taskId, ownerId, contentType) {
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[contentType];
  if (!extension) throw new Error('INVALID_PHOTO');
  return `${taskId}/${ownerId}.${extension}`;
}

export async function uploadTemporaryPhoto(path, photo) {
  const response = await fetch(objectUrl(path), {
    method: 'POST', headers: { ...headers(photo.contentType), 'cache-control': 'max-age=0', 'x-upsert': 'false' }, body: photo.bytes,
  });
  if (response.status === 409) return { stored: false, existed: true };
  if (response.status === 400) {
    const detail = (await response.text()).slice(0, 200);
    if (/already exists|duplicate/i.test(detail)) return { stored: false, existed: true };
    throw new Error('Temporary photo upload was rejected');
  }
  if (!response.ok) throw new Error(`Temporary photo upload failed (${response.status})`);
  return { stored: true, existed: false };
}

export async function downloadTemporaryPhoto(path) {
  const response = await fetch(objectUrl(path), { headers: headers() });
  if (!response.ok) throw new Error(`Temporary photo download failed (${response.status})`);
  const contentType = response.headers.get('content-type')?.split(';')[0];
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) throw new Error('INVALID_STORED_PHOTO');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('INVALID_STORED_PHOTO');
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export async function deleteTemporaryPhoto(path) {
  const { url } = config();
  const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: 'DELETE', headers: headers('application/json'), body: JSON.stringify({ prefixes: [path] }),
  });
  if (!response.ok && response.status !== 404) throw new Error(`Temporary photo deletion failed (${response.status})`);
  const marked = await fetch(`${url}/rest/v1/rpc/mark_analysis_photo_deleted`, {
    method: 'POST', headers: headers('application/json'), body: JSON.stringify({ p_photo_path: path }),
  });
  if (!marked.ok) throw new Error(`Temporary photo cleanup mark failed (${marked.status})`);
}

export async function deleteTemporaryPhotos(paths) {
  await Promise.allSettled(paths.map((path) => deleteTemporaryPhoto(path)));
}
