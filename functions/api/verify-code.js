import verifyCodeHandler from '../../api/verify-code.js';
import { adaptVercelHandlerForCloudflare } from '../../lib/cloudflare-adapter.js';

const handleRequest = adaptVercelHandlerForCloudflare(verifyCodeHandler);

export function onRequest(context) {
  return handleRequest(context.request);
}
