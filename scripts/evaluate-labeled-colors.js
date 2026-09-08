import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { COLOR_IDENTITY_CODES } from '../lib/color-framework.js';

export function evaluateLabeledColors(dataset) {
  if (dataset?.schemaVersion !== 1 || !Array.isArray(dataset.samples)) throw Error('Invalid dataset schema');
  const ids = new Set(), subjectSplits = new Map(), photoOwners = new Map();
  for (const row of dataset.samples) {
    for (const key of ['id', 'subjectId', 'photoId', 'condition', 'modelVersion', 'promptVersion', 'algorithmVersion']) {
      if (typeof row[key] !== 'string' || !row[key].trim()) throw Error('Missing ' + key);
    }
    if (ids.has(row.id)) throw Error('Duplicate sample id');
    ids.add(row.id);
    if (!['development', 'test'].includes(row.split)) throw Error('Invalid split');
    if (subjectSplits.has(row.subjectId) && subjectSplits.get(row.subjectId) !== row.split) throw Error('Subject leakage across splits');
    subjectSplits.set(row.subjectId, row.split);
    if (photoOwners.has(row.photoId) && photoOwners.get(row.photoId) !== row.subjectId) throw Error('Photo assigned to multiple subjects');
    photoOwners.set(row.photoId, row.subjectId);
    if (row.prediction !== null && !COLOR_IDENTITY_CODES.has(row.prediction)) throw Error('Invalid prediction');
    if (row.label !== null && !COLOR_IDENTITY_CODES.has(row.label)) throw Error('Invalid label');
    if (row.label !== null && (row.labelStatus !== 'adjudicated' || !Array.isArray(row.reviewerIds) || new Set(row.reviewerIds.filter(v => typeof v === 'string' && v.trim())).size < 2)) {
      throw Error('Labels require independent review and adjudication');
    }
  }
  const testRows = dataset.samples.filter(r => r.split === 'test');
  const versions = new Set(testRows.map(r => JSON.stringify([r.modelVersion, r.promptVersion, r.algorithmVersion])));
  if (versions.size > 1) throw Error('Evaluate one model/prompt/algorithm version at a time');
  const labeled = testRows.filter(r => r.label !== null);
  const confusion = Object.fromEntries([...COLOR_IDENTITY_CODES].map(code => [code, {}]));
  for (const row of labeled) {
    const predicted = row.prediction ?? 'ABSTAIN';
    confusion[row.label][predicted] = (confusion[row.label][predicted] || 0) + 1;
  }
  const perClass = [...COLOR_IDENTITY_CODES].map(code => {
    const support = labeled.filter(r => r.label === code).length;
    const tp = labeled.filter(r => r.label === code && r.prediction === code).length;
    const fp = labeled.filter(r => r.label !== code && r.prediction === code).length;
    return { code, support, recall: support ? tp / support : null,
      f1: support ? 2 * tp / (2 * tp + fp + support - tp) : null };
  });
  const supported = perClass.filter(c => c.support > 0);
  const repeated = new Map();
  for (const row of testRows) {
    const key = JSON.stringify([row.subjectId, row.photoId, row.condition]);
    if (!repeated.has(key)) repeated.set(key, []);
    repeated.get(key).push(row.prediction);
  }
  const groups = [...repeated.values()].filter(g => g.length > 1);
  const correct = labeled.filter(r => r.prediction === r.label).length;
  return {
    status: labeled.length ? 'descriptive-results-not-certification' : 'not-validated',
    labeledTestRuns: labeled.length,
    labeledTestSubjects: new Set(labeled.map(r => r.subjectId)).size,
    labeledTestPhotos: new Set(labeled.map(r => r.photoId)).size,
    accuracyPerRun: labeled.length ? correct / labeled.length : null,
    abstentionRate: labeled.length ? labeled.filter(r => r.prediction === null).length / labeled.length : null,
    macroF1SupportedClasses: supported.length ? supported.reduce((s, c) => s + c.f1, 0) / supported.length : null,
    supportedClasses: supported.length, totalClasses: COLOR_IDENTITY_CODES.size,
    repeatedPhotoGroups: groups.length,
    repeatAgreement: groups.length ? groups.filter(g => new Set(g).size === 1).length / groups.length : null,
    repeatAllAbstainGroups: groups.filter(g => g.every(v => v === null)).length,
    confidenceCalibration: 'not-measured',
    perClass, confusion,
    caveats: ['Repeated runs are correlated; per-run accuracy is not independent-subject accuracy.',
      'Repeat agreement includes abstentions and is not evidence of correctness.',
      'Reviewer independence and consent require external audit; this tool checks fields only.'],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2]) throw Error('Usage: node scripts/evaluate-labeled-colors.js <local-dataset.json>');
  console.log(JSON.stringify(evaluateLabeledColors(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
}
