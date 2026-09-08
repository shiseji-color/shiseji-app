import { pathToFileURL } from 'node:url';
import { COLOR_DIMENSION_KEYS, COLOR_IDENTITY_OPTIONS, assessColorIdentity, deriveColorAxes } from '../lib/color-framework.js';

// Synthetic observations constructed from existing rule targets, NOT human labels.
export function observationsForTarget([warmth, lightness, clarity, softness, contrast]) {
  const lower = Math.max(0, 100 - 3 * softness, 3 * contrast - 200);
  const upper = Math.min(100, 300 - 3 * softness, 3 * contrast);
  if (lower > upper) throw Error('Unreachable target');
  const facial = Math.max(lower, Math.min(upper, 100 - softness));
  const values = {
    skin_temperature: warmth, cheek_temperature: warmth, lip_temperature: warmth, hair_temperature: warmth,
    skin_lightness: lightness, brightness_capacity: lightness, eye_depth: 100 - lightness, hair_depth: 100 - lightness,
    skin_clarity: clarity, eye_clarity: clarity, chroma_capacity: clarity,
    facial_contrast: facial, skin_softness: (3 * softness - 100 + facial) / 2,
    muted_capacity: (3 * softness - 100 + facial) / 2,
    hair_skin_contrast: (3 * contrast - facial) / 2, depth_capacity: (3 * contrast - facial) / 2,
  };
  return COLOR_DIMENSION_KEYS.map(key => ({ key, value: values[key] }));
}

export function evaluateColorFramework() {
  const centers = COLOR_IDENTITY_OPTIONS.map(profile => {
    const input = observationsForTarget(profile.target);
    const base = assessColorIdentity(input);
    const changes = [];
    for (const key of COLOR_DIMENSION_KEYS) for (const delta of [-5, 5]) {
      const perturbed = input.map(d => ({ ...d, value: d.key === key ? Math.max(0, Math.min(100, d.value + delta)) : d.value }));
      const next = assessColorIdentity(perturbed);
      if (next.primary.code !== base.primary.code) changes.push({ key, delta, to: next.primary.code, level: next.level });
    }
    return { code: profile.code, recovered: base.primary.code === profile.code,
      maxAxisError: Math.max(...Object.values(deriveColorAxes(input)).map((v, i) => Math.abs(v - profile.target[i]))),
      perturbations: 32, changes };
  });
  // Pair midpoints are not necessarily decision boundaries: a third class can be nearer.
  const midpointCases = [];
  for (let i = 0; i < COLOR_IDENTITY_OPTIONS.length; i++) for (let j = i + 1; j < COLOR_IDENTITY_OPTIONS.length; j++) {
    const first = COLOR_IDENTITY_OPTIONS[i], second = COLOR_IDENTITY_OPTIONS[j];
    const input = observationsForTarget(first.target.map((v, k) => (v + second.target[k]) / 2));
    const assessment = assessColorIdentity(input);
    midpointCases.push({ pair: [first.code, second.code], ...assessment });
  }
  return {
    evidenceType: 'synthetic-rule-diagnostics',
    humanLabeledSamples: 0,
    realWorldAccuracy: null,
    confidenceCalibration: 'not-validated',
    limitations: ['Center recovery is circular by construction, not classification accuracy.',
      'Single-coordinate perturbations do not simulate camera lighting or repeated model observations.',
      'high/medium/low are distance heuristics, not calibrated probabilities.'],
    summary: { centers: centers.length, recovered: centers.filter(c => c.recovered).length,
      singleDimensionTrials: centers.reduce((n, c) => n + c.perturbations, 0),
      singleDimensionFlips: centers.reduce((n, c) => n + c.changes.length, 0),
      midpointTrials: midpointCases.length,
      lowConfidenceMidpoints: midpointCases.filter(c => c.level === 'low').length },
    centers, midpointCases,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = evaluateColorFramework();
  console.log(JSON.stringify(process.argv.includes('--full') ? report : {
    evidenceType: report.evidenceType, summary: report.summary,
    realWorldAccuracy: report.realWorldAccuracy, confidenceCalibration: report.confidenceCalibration,
    limitations: report.limitations,
  }, null, 2));
}
