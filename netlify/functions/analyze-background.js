import analyze from '../../api/analyze.js';
import { completeAnalysisJob, claimAnalysisJob, failAnalysisJob } from '../../lib/activation-store.js';
import { classifyAnalysisFailure, preserveAnalysisFailure } from '../../lib/analysis-error.js';
import { parseBackgroundEvent, runAnalysisHandler } from '../../lib/analysis-handler-adapter.js';
import { createAnalysisToken, createVisualToken, verifyAnalysisWorkerToken } from '../../lib/analysis-token.js';
import { processBackgroundAnalysis } from '../../lib/analysis-job-worker.js';
import { prepareBackgroundAnalysisInput } from '../../lib/background-analysis-input.js';
import { deleteTemporaryPhoto, downloadTemporaryPhoto } from '../../lib/temporary-photo-store.js';

export const handler = async (event) => {
  let claims;
  try {
    claims = parseBackgroundEvent(event, verifyAnalysisWorkerToken);
  } catch {
    console.error('Background analysis failed:', 'background_payload_invalid');
    return;
  }
  try {
    const outcome = await processBackgroundAnalysis({
      claim: () => claimAnalysisJob(claims),
      analyze: async () => runAnalysisHandler(analyze,
        await prepareBackgroundAnalysisInput(claims, {
          downloadPhoto: downloadTemporaryPhoto,
          createToken: createAnalysisToken,
        })),
      complete: (data) => completeAnalysisJob(
        claims, data,
        data.season_en === 'PHOTO_NOT_ELIGIBLE' ? null : createVisualToken(claims.codeHash, claims.requestId, data),
      ),
      fail: (reason) => failAnalysisJob(claims, reason),
      cleanup: async () => {
        try { await deleteTemporaryPhoto(claims.photoPath); }
        catch { console.error('Temporary photo cleanup failed:', 'photo_cleanup_failed'); }
      },
    });
    if (outcome.diagnosticCode) {
      console.error('Background analysis diagnostic:', outcome.diagnosticCode);
    }
  } catch (error) {
    const safeError = preserveAnalysisFailure(error, 'background_handler_failed');
    if (claims) {
      try { await failAnalysisJob(claims, safeError.failureCode); }
      catch { console.error('Background analysis failed:', 'analysis_failure_write_failed'); return; }
    }
    console.error('Background analysis failed:', classifyAnalysisFailure(safeError));
  }
};
