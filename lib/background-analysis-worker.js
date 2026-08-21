import { analyzeBackgroundInput } from '../api/analyze.js';
import { completeAnalysisJob, claimAnalysisJob, failAnalysisJob } from './activation-store.js';
import { classifyAnalysisFailure, preserveAnalysisFailure } from './analysis-error.js';
import { parseBackgroundEvent } from './analysis-handler-adapter.js';
import { createAnalysisToken, createVisualToken, verifyAnalysisWorkerToken } from './analysis-token.js';
import { processBackgroundAnalysis } from './analysis-job-worker.js';
import { prepareBackgroundAnalysisInput } from './background-analysis-input.js';
import { deleteTemporaryPhoto, downloadTemporaryPhoto } from './temporary-photo-store.js';

export function createBackgroundAnalysisHandler(dependencies = {}) {
  const {
    analyze = analyzeBackgroundInput,
    claim = claimAnalysisJob,
    complete = completeAnalysisJob,
    createToken = createAnalysisToken,
    createVisual = createVisualToken,
    deletePhoto = deleteTemporaryPhoto,
    downloadPhoto = downloadTemporaryPhoto,
    fail = failAnalysisJob,
    verifyWorkerToken = verifyAnalysisWorkerToken,
  } = dependencies;

  return async (event) => {
    let claims;
    try {
      claims = parseBackgroundEvent(event, verifyWorkerToken);
    } catch {
      console.error('Background analysis failed:', 'background_payload_invalid');
      return;
    }
    try {
      const outcome = await processBackgroundAnalysis({
        claim: () => claim(claims),
        analyze: async () => analyze(await prepareBackgroundAnalysisInput(claims, {
          downloadPhoto,
          createToken,
        })),
        complete: (data) => complete(
          claims, data,
          data.season_en === 'PHOTO_NOT_ELIGIBLE'
            ? null
            : createVisual(claims.codeHash, claims.requestId, data),
        ),
        fail: (reason) => fail(claims, reason),
        cleanup: async () => {
          try { await deletePhoto(claims.photoPath); }
          catch { console.error('Temporary photo cleanup failed:', 'photo_cleanup_failed'); }
        },
      });
      if (outcome.diagnosticCode) {
        console.error('Background analysis diagnostic:', outcome.diagnosticCode);
      }
    } catch (error) {
      const safeError = preserveAnalysisFailure(error, 'background_worker_failed');
      if (claims) {
        try { await fail(claims, safeError.failureCode); }
        catch { console.error('Background analysis failed:', 'analysis_failure_write_failed'); return; }
      }
      console.error('Background analysis failed:', classifyAnalysisFailure(safeError));
    }
  };
}
