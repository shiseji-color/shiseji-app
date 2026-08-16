import { runAnalysisStage } from './analysis-error.js';

export async function prepareBackgroundAnalysisInput(claims, dependencies) {
  const imageBase64 = await runAnalysisStage(
    'photo_download_failed',
    () => dependencies.downloadPhoto(claims.photoPath),
  );
  const analysisToken = runAnalysisStage(
    'model_request_build_failed',
    () => dependencies.createToken(claims.codeHash),
  );
  return { imageBase64, analysisToken, requestId: claims.requestId };
}
