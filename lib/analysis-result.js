import { analysisFailureError } from './analysis-error.js';
import { validateAnalysisResult } from './analysis-schema.js';
import { applyIdentityKnowledge } from './color-framework.js';

export function parseAnalysisResult(rawText, dependencies = {}) {
  if (typeof rawText !== 'string' || !rawText.trim()) throw analysisFailureError('model_empty_response');

  const text = rawText.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { throw analysisFailureError('model_invalid_json'); }

  let validated;
  try { validated = (dependencies.validate || validateAnalysisResult)(parsed); }
  catch { throw analysisFailureError('model_schema_invalid'); }

  if (validated.season_en === 'PHOTO_NOT_ELIGIBLE') return validated;
  try { return (dependencies.applyKnowledge || applyIdentityKnowledge)(validated); }
  catch { throw analysisFailureError('analysis_rule_failed'); }
}
