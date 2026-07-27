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

function optionalTextArray(value, field, maxItems, maxItemLength) {
  if (value == null) return [];
  return boundedArray(value, field, maxItems).map((item, index) =>
    requiredText(item, `${field}[${index}]`, maxItemLength),
  );
}

export function validateAnalysisResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('AI response must be a JSON object');
  }

  const result = {
    season_name: requiredText(value.season_name, 'season_name', 80),
    season_en: requiredText(value.season_en, 'season_en', 80),
    description: requiredText(value.description, 'description'),
    style_keywords: optionalTextArray(
      value.style_keywords,
      'style_keywords',
      5,
      20,
    ),
    color_impression: optionalText(
      value.color_impression,
      'color_impression',
      180,
    ),
    feature_colors: boundedArray(
      value.feature_colors,
      'feature_colors',
      8,
    ).map((item, index) => ({
      label: requiredText(item?.label, `feature_colors[${index}].label`, 40),
      hex: hexColor(item?.hex, `feature_colors[${index}].hex`),
    })),
    radar_data: boundedArray(value.radar_data, 'radar_data', 8).map(
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
    best_colors: boundedArray(value.best_colors, 'best_colors', 16).map(
      (item, index) => ({
        name: requiredText(item?.name, `best_colors[${index}].name`, 40),
        hex: hexColor(item?.hex, `best_colors[${index}].hex`),
      }),
    ),
    makeup_advice: optionalText(value.makeup_advice, 'makeup_advice'),
    outfit_advice: optionalText(value.outfit_advice, 'outfit_advice'),
    accessory_advice: optionalText(value.accessory_advice, 'accessory_advice'),
    celebrity_reference: optionalText(
      value.celebrity_reference,
      'celebrity_reference',
      500,
    ),
    avoid_colors: boundedArray(value.avoid_colors, 'avoid_colors', 16).map(
      (item, index) =>
        requiredText(
          typeof item === 'string' ? item : item?.name,
          `avoid_colors[${index}]`,
          40,
        ),
    ),
  };

  return result;
}
