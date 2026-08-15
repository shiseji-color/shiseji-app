import { analysisFailureError, preserveAnalysisFailure } from './analysis-error.js';

export function parseBackgroundEvent(event, verifyToken) {
  try {
    const rawBody = event?.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event?.body || '{}';
    const body = JSON.parse(rawBody);
    return verifyToken(body.workerToken);
  } catch {
    throw analysisFailureError('background_payload_invalid');
  }
}

export function runAnalysisHandler(handler, body) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    let settled = false;
    const finish = (operation) => {
      if (settled) return;
      settled = true;
      operation();
    };
    const response = {
      setHeader() {},
      status(code) { statusCode = code; return response; },
      json(payload) {
        if (statusCode >= 400) {
          const code = payload?.diagnosticCode;
          finish(() => reject(analysisFailureError(
            code && code !== 'analysis_failed'
              ? code
              : code === 'analysis_failed'
                ? 'background_handler_failed'
                : 'analysis_diagnostic_missing',
          )));
        } else if (!payload || !Object.hasOwn(payload, 'data')) {
          finish(() => reject(analysisFailureError('analysis_handler_response_invalid')));
        } else {
          finish(() => resolve(payload.data));
        }
        return response;
      },
    };

    try {
      Promise.resolve(handler({ method: 'POST', headers: {}, body, backgroundMode: true }, response))
        .catch((error) => finish(() => reject(
          preserveAnalysisFailure(error, 'background_handler_failed'),
        )));
    } catch (error) {
      finish(() => reject(preserveAnalysisFailure(error, 'background_handler_failed')));
    }
  });
}
