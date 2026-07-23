import analyze from '../../api/analyze.js';
import { adaptVercelHandler } from '../../lib/netlify-adapter.js';

export const handler = adaptVercelHandler(analyze);
