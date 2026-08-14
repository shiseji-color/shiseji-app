import generateStyleImage from '../../api/generate-style-image.js';
import { adaptVercelHandler } from '../../lib/netlify-adapter.js';

export const handler = adaptVercelHandler(generateStyleImage);
