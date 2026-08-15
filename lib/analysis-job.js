import { classifyAnalysisFailure } from './analysis-error.js';

export async function runAnalysisJob({ claim, analyze, complete, fail }) {
  const status = await claim();
  if (status !== 'claimed') return { status: status || 'missing', ranModel: false };
  let result;
  try {
    result = await analyze();
  } catch (error) {
    await fail(classifyAnalysisFailure(error));
    return { status: 'failed', ranModel: true, error };
  }
  try {
    const completion = await complete(result);
    if (!completion?.completed) throw new Error('Analysis completion was rejected');
    return { status: 'completed', ranModel: true, result };
  } catch (error) {
    // A model result may already have been paid for. Keep processing locked so
    // Netlify retries or duplicate requests can never call the model twice.
    return { status: 'processing', ranModel: true, error };
  }
}
