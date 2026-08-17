import { COLOR_DIMENSION_KEYS } from './color-framework.js';

const HEX_PATTERN = /^#[0-9A-F]{6}$/i;
const MAX_TEXT_LENGTH = 1200;

function requiredText(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') {
    throw new Error(`AI response field ${field} must be a string`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`AI response field ${field} has an invalid length`);
  }

  return normalized;
}

function hexColor(value, field) {
  const normalized = requiredText(value, field, 7).toUpperCase();
  if (!HEX_PATTERN.test(normalized)) {
    throw new Error(`AI response field ${field} is not a hex color`);
  }
  return normalized;
}

function exactArray(value, field, expectedItems) {
  if (!Array.isArray(value) || value.length !== expectedItems) {
    throw new Error(
      `AI response field ${field} must contain exactly ${expectedItems} items`,
    );
  }
  return value;
}

export function validateAnalysisResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI response must be a JSON object');
  }

  if (value.season_en === 'PHOTO_NOT_ELIGIBLE') {
    return {
      identity_code: 'PHOTO_NOT_ELIGIBLE',
      season_name: '无法完成诊断',
      season_en: 'PHOTO_NOT_ELIGIBLE',
      description: requiredText(value.description, 'description'),
      style_keywords: [],
      color_impression: '',
      feature_colors: [],
      radar_data: [],
      dimension_data: [],
      best_colors: [],
      makeup_advice: '',
      outfit_advice: '',
      accessory_advice: '',
      style_reference: '',
      avoid_colors: [],
    };
  }

  return {
    // The server fills these fields from the fixed identity knowledge base after
    // validating the photo observations. Model placeholders are not consumed.
    identity_code: '',
    season_name: '',
    season_en: '',
    description: requiredText(value.description, 'description'),
    style_keywords: [],
    color_impression: requiredText(
      value.color_impression,
      'color_impression',
      180,
    ),
    feature_colors: exactArray(
      value.feature_colors,
      'feature_colors',
      4,
    ).map((item, index) => ({
      label: requiredText(item?.label, `feature_colors[${index}].label`, 40),
      hex: hexColor(item?.hex, `feature_colors[${index}].hex`),
    })),
    radar_data: [],
    dimension_data: exactArray(value.dimension_data, 'dimension_data', 16).map(
      (item, index) => {
        const numericValue = Number(item?.value);
        const expectedKey = COLOR_DIMENSION_KEYS[index];
        if (item?.key !== expectedKey) {
          throw new Error(
            `AI response field dimension_data[${index}].key must be ${expectedKey}`,
          );
        }
        if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
          throw new Error(`AI response field dimension_data[${index}].value is invalid`);
        }
        return {
          key: expectedKey,
          name: requiredText(item?.name, `dimension_data[${index}].name`, 40),
          value: numericValue,
          observation: requiredText(
            item?.observation,
            `dimension_data[${index}].observation`,
            120,
          ),
        };
      },
    ),
    best_colors: [],
    makeup_advice: '',
    outfit_advice: '',
    accessory_advice: '',
    style_reference: '',
    avoid_colors: [],
  };
}
