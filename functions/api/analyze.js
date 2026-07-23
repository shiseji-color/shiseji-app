import analyzeHandler from '../../api/analyze.js';
import { adaptVercelHandlerForCloudflare } from '../../lib/cloudflare-adapter.js';

const handleRequest = adaptVercelHandlerForCloudflare(analyzeHandler);

export function onRequest(context) {
  return handleRequest(context.request);
}
