import verifyCode from '../../api/verify-code.js';
import { adaptVercelHandler } from '../../lib/netlify-adapter.js';

export const handler = adaptVercelHandler(verifyCode);
