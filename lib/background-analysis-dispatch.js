import { waitUntil } from '@vercel/functions';
import { createBackgroundAnalysisHandler } from './background-analysis-worker.js';

function netlifyBackgroundUrl(req, env) {
  const allowed = [env.DEPLOY_PRIME_URL, env.URL].filter(Boolean).map((value) => new URL(value));
  const forwardedHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const origin = allowed.find((url) => url.host === forwardedHost) || allowed[0];
  if (!origin) throw new Error('Netlify site URL is unavailable');
  return new URL('/.netlify/functions/analyze-background', origin).href;
}

export function createBackgroundDispatcher(dependencies = {}) {
  const defer = dependencies.defer || waitUntil;
  const fetchImpl = dependencies.fetchImpl;
  const worker = dependencies.worker || createBackgroundAnalysisHandler();
  const env = dependencies.env || process.env;

  return async function dispatchBackground(req, body) {
    if (env.VERCEL === '1') {
      defer(worker({ body }));
      return;
    }
    const queued = await (fetchImpl || globalThis.fetch)(netlifyBackgroundUrl(req, env), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (queued.status !== 202) throw new Error(`Background queue rejected (${queued.status})`);
  };
}

export const dispatchBackground = createBackgroundDispatcher();
