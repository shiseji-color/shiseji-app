import {
  COLOR_DIMENSION_KEYS,
  COLOR_IDENTITY_CODES,
} from './color-framework.js';

const HEX_PATTERN = /^#[0-9A-F]{6}$/i;
const MAX_TEXT_LENGTH = 1200;
const MAX_LIST_ITEMS = 16;

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

function optionalText(value, field, maxLength = MAX_TEXT_LENGTH) {
  if (value == null || value === '') return '';
  return requiredText(value, field, maxLength);
}

function hexColor(value, field) {
  const normalized = requiredText(value, field, 7).toUpperCase();
  if (!HEX_PATTERN.test(normalized)) {
    throw new Error(`AI response field ${field} is not a hex color`);
  }
  return normalized;
}

function boundedArray(value, field, maxItems = MAX_LIST_ITEMS) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new Error(`AI response field ${field} must be a bounded array`);
  }
  return value;
}

function exactArray(value, field, expectedItems) {
  if (!Array.isArray(value) || value.length !== expectedItems) {
    throw new Error(
      `AI response field ${field} must contain exactly ${expectedItems} items`,
    );
  }
  return value;
}

function optionalTextArray(value, field, maxItems, maxItemLength) {
  if (value == null) return [];
  return boundedArray(value, field, maxItems).map((item, index) =>
    requiredText(item, `${field}[${index}]`, maxItemLength),
  );
}

function exactTextArray(value, field, expectedItems, maxItemLength) {
  return exactArray(value, field, expectedItems).map((item, index) =>
    requiredText(item, `${field}[${index}]`, maxItemLength),
  );
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

  const result = {
    identity_code: requiredText(value.identity_code, 'identity_code', 16),
    season_name: requiredText(value.season_name, 'season_name', 80),
    season_en: requiredText(value.season_en, 'season_en', 80),
    description: requiredText(value.description, 'description'),
    style_keywords: exactTextArray(
      value.style_keywords,
      'style_keywords',
      3,
      20,
    ),
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
    radar_data: exactArray(value.radar_data, 'radar_data', 5).map(
      (item, index) => {
        const numericValue = Number(item?.value);
        if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 100) {
          throw new Error(`AI response field radar_data[${index}].value is invalid`);
        }
        return {
          name: requiredText(item?.name, `radar_data[${index}].name`, 40),
          value: numericValue,
          desc: optionalText(item?.desc, `radar_data[${index}].desc`, 120),
        };
      },
    ),
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
    best_colors: exactArray(value.best_colors, 'best_colors', 8).map(
      (item, index) => ({
        name: requiredText(item?.name, `best_colors[${index}].name`, 40),
        hex: hexColor(item?.hex, `best_colors[${index}].hex`),
      }),
    ),
    makeup_advice: requiredText(value.makeup_advice, 'makeup_advice'),
    outfit_advice: requiredText(value.outfit_advice, 'outfit_advice'),
    accessory_advice: requiredText(value.accessory_advice, 'accessory_advice'),
    style_reference: requiredText(
      value.style_reference,
      'style_reference',
      500,
    ),
    avoid_colors: exactArray(value.avoid_colors, 'avoid_colors', 3).map(
      (item, index) =>
        requiredText(
          typeof item === 'string' ? item : item?.name,
          `avoid_colors[${index}]`,
          40,
        ),
    ),
  };

  if (!COLOR_IDENTITY_CODES.has(result.identity_code)) {
    throw new Error('AI response field identity_code is not supported');
  }

  return result;
}
