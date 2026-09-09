import { assertStagingTarget } from '../lib/staging-guard.js';

const url = process.env.SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !key) {
  throw new Error('Missing staging Supabase configuration.');
}

if (url === '[SENSITIVE]' || key === '[SENSITIVE]') {
  throw new Error(
    'Vercel withheld the staging Supabase secret. Pulling environment metadata does not provide a usable credential.',
  );
}

const projectRef = assertStagingTarget(url);

if (!key.startsWith('sb_secret_') || /\s/.test(key)) {
  throw new Error('The staging secret key format is invalid.');
}

const response = await fetch(
  `${url}/rest/v1/activation_codes?select=*&limit=1`,
  {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
    },
    signal: AbortSignal.timeout(15_000),
  },
);

if (!response.ok) {
  throw new Error(`Staging Supabase verification failed with HTTP ${response.status}.`);
}

console.log(`Staging Supabase authentication verified for ${projectRef}.`);
