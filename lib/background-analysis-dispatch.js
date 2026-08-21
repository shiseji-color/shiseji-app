import { DuplicateMessageError, send } from '@vercel/queue';

export const ANALYSIS_QUEUE_TOPIC = 'analysis-jobs';

function netlifyBackgroundUrl(req, env) {
  const allowed = [env.DEPLOY_PRIME_URL, env.URL].filter(Boolean).map((value) => new URL(value));
  const forwardedHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const origin = allowed.find((url) => url.host === forwardedHost) || allowed[0];
  if (!origin) throw new Error('Netlify site URL is unavailable');
  return new URL('/.netlify/functions/analyze-background', origin).href;
}

export function createBackgroundDispatcher(dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl;
  const sendQueue = dependencies.sendQueue || send;
  const env = dependencies.env || process.env;

  return async function dispatchBackground(req, body, taskId) {
    if (env.VERCEL === '1') {
      const idempotencyKey = `analysis-${taskId}`;
      try {
        await sendQueue(ANALYSIS_QUEUE_TOPIC, JSON.parse(body), {
          idempotencyKey,
          retentionSeconds: 60 * 60,
        });
      } catch (error) {
        if (!(error instanceof DuplicateMessageError)
          || error.idempotencyKey !== idempotencyKey) throw error;
      }
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
