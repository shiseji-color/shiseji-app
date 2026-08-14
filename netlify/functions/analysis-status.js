import status from '../../api/analysis-status.js';
import { adaptVercelHandler } from '../../lib/netlify-adapter.js';

export const handler = adaptVercelHandler(status);
