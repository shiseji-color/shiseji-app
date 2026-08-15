import analyze from '../../api/analyze.js';
import { completeAnalysisJob, claimAnalysisJob, failAnalysisJob } from '../../lib/activation-store.js';
import { createAnalysisToken, createVisualToken, verifyAnalysisWorkerToken } from '../../lib/analysis-token.js';
import { processBackgroundAnalysis } from '../../lib/analysis-job-worker.js';
import { deleteTemporaryPhoto, downloadTemporaryPhoto } from '../../lib/temporary-photo-store.js';

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
  try {
    const body = JSON.parse(event.body || '{}');
    const claims = verifyAnalysisWorkerToken(body.workerToken);
    await processBackgroundAnalysis({
      claim: () => claimAnalysisJob(claims),
      analyze: async () => runLegacyHandler({
        imageBase64: await downloadTemporaryPhoto(claims.photoPath),
        analysisToken: createAnalysisToken(claims.codeHash),
        requestId: claims.requestId,
      }),
      complete: (data) => completeAnalysisJob(
        claims, data,
        data.season_en === 'PHOTO_NOT_ELIGIBLE' ? null : createVisualToken(claims.codeHash, claims.requestId, data),
      ),
      fail: (reason) => failAnalysisJob(claims, reason),
      cleanup: async () => {
        try { await deleteTemporaryPhoto(claims.photoPath); }
        catch (error) { console.error('Temporary photo cleanup failed:', error?.message || 'unknown'); }
      },
    });
  } catch (error) {
    console.error('Background analysis failed:', error?.message || 'unknown');
  }
};
