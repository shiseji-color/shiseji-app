import analyze from '../../api/start-analysis.js';
import { adaptVercelHandler } from '../../lib/netlify-adapter.js';

export const handler = adaptVercelHandler(analyze);
