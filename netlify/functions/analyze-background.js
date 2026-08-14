import analyze from '../../api/analyze.js';
import { completeAnalysisJob, claimAnalysisJob, failAnalysisJob } from '../../lib/activation-store.js';
import { createVisualToken, verifyAnalysisWorkerToken } from '../../lib/analysis-token.js';
import { runAnalysisJob } from '../../lib/analysis-job.js';

function runLegacyHandler(body) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const response = {
      setHeader() {},
      status(code) { statusCode = code; return response; },
      json(payload) {
        if (statusCode >= 400) reject(new Error(payload?.error || 'Analysis failed'));
        else resolve(payload.data);
        return response;
      },
    };
    Promise.resolve(analyze({ method: 'POST', headers: {}, body, backgroundMode: true }, response)).catch(reject);
  });
}

export const handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
    const claims = verifyAnalysisWorkerToken(body.workerToken);
    if (claims.requestId !== body.requestId) throw new Error('Worker binding mismatch');
    await runAnalysisJob({
      claim: () => claimAnalysisJob(claims),
      analyze: () => runLegacyHandler(body),
      complete: (data) => completeAnalysisJob(
        claims, data,
        data.season_en === 'PHOTO_NOT_ELIGIBLE' ? null : createVisualToken(claims.codeHash, claims.requestId, data),
      ),
      fail: (reason) => failAnalysisJob(claims, reason),
    });
  } catch (error) {
    console.error('Background analysis failed:', error?.message || 'unknown');
  }
};
