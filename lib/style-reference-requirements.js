import { COLOR_DIMENSION_KEYS, COLOR_IDENTITY_OPTIONS, assessColorIdentity, deriveColorAxes } from './color-framework.js';
import { styleReferenceCatalog, selectProfileStyleReference } from './style-reference-catalog.js';

// Deterministic validation and editorial requirements, independent of LLM labels.
export function buildStyleReferenceRequirements(result) {
  if (result?.season_en === 'PHOTO_NOT_ELIGIBLE') return { status: 'photo-ineligible', requirements: [] };
  const dimensions = result?.dimension_data;
  if (!Array.isArray(dimensions) || dimensions.length !== COLOR_DIMENSION_KEYS.length ||
      new Set(dimensions.map(d => d?.key)).size !== COLOR_DIMENSION_KEYS.length ||
      dimensions.some(d => !COLOR_DIMENSION_KEYS.includes(d?.key) ||
        typeof d.value !== 'number' || !Number.isFinite(d.value) || d.value < 0 || d.value > 100)) {
    return { status: 'invalid-observations', requirements: [] };
  }
  const assessment = assessColorIdentity(dimensions);
  const identity = COLOR_IDENTITY_OPTIONS.find(p => p.code === result.identity_code);
  if (!identity || identity.code !== assessment.primary.code) {
    return { status: 'identity-mismatch', requirements: [] };
  }
  const axes = deriveColorAxes(dimensions);
  return {
    status: assessment.level === 'low' ? 'review-needed' : 'ready-for-asset-review',
    profileId: identity.code,
    canonicalName: identity.name,
    displayNameMismatch: result.season_name !== identity.name,
    assessment,
    axes,
    requirements: ['beauty', 'outfit'].map(kind => ({
      kind,
      profileId: identity.code,
      guidance: kind === 'beauty' ? identity.makeup : identity.outfit,
      palette: identity.palette.map(([name, hex]) => ({ name, hex })),
      accessory: identity.accessory,
      style: identity.style,
      assetStatus: 'requires-reviewed-mapping',
    })),
  };
}

/**
 * Browser/server shared resolver. Recomputes fit from observations; never trusts
 * supplied identity_assessment. Released images remain fictional references.
 * No image generation, cross-profile borrowing, or calibrated accuracy claim.
 */
export function resolveStyleReferences(result, { scope } = {}) {
  const checked = buildStyleReferenceRequirements(result);
  const empty = reason => ({
    status: reason,
    profileId: checked.profileId ?? null,
    canonicalName: checked.canonicalName ?? null,
    assessment: checked.assessment ?? null,
    assets: { beauty: null, outfit: null },
    reasons: { beauty: reason, outfit: reason },
  });
  // Uncertainty remains in the report; it does not invalidate a fictional palette example.
  if (!['ready-for-asset-review', 'review-needed'].includes(checked.status)) return empty(checked.status);
  if (!['staging', 'production'].includes(scope)) return empty('not-released');
  const beauty = selectProfileStyleReference({ profileId: checked.profileId, kind: 'beauty', scope });
  const outfit = selectProfileStyleReference({ profileId: checked.profileId, kind: 'outfit', scope });
  return {
    status: beauty.asset && outfit.asset ? 'ready' : 'missing-assets',
    profileId: checked.profileId,
    canonicalName: checked.canonicalName,
    assessment: checked.assessment,
    assets: { beauty: beauty.asset, outfit: outfit.asset },
    reasons: { beauty: beauty.reason, outfit: outfit.reason },
  };
}

// Coverage reports the exact reviewed mapping for every profile and use case.
export function getStyleReferenceCoverage() {
  return COLOR_IDENTITY_OPTIONS.map(profile => ({
    profileId: profile.code,
    name: profile.name,
    kinds: ['beauty', 'outfit'].map(kind => ({
      kind,
      candidateIds: styleReferenceCatalog.filter(a => a.profileId === profile.code && a.kind === kind).map(a => a.id),
    })),
  }));
}
