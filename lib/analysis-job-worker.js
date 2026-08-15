import { runAnalysisJob } from './analysis-job.js';

export async function processBackgroundAnalysis(dependencies) {
  const outcome = await runAnalysisJob({
    claim: dependencies.claim,
    analyze: dependencies.analyze,
    complete: dependencies.complete,
    fail: dependencies.fail,
  });
  if (outcome.ranModel) await dependencies.cleanup();
  return outcome;
}
