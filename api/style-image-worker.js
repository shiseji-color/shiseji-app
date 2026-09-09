import { QueueClient } from '@vercel/queue';
import { createBackgroundStyleImageHandler } from '../lib/background-style-image-worker.js';

export function createStyleImageQueueMessageHandler(dependencies = {}) {
  const worker = dependencies.worker || createBackgroundStyleImageHandler();
  return async function handleStyleImageQueueMessage(message) {
    if (!message || typeof message.workerToken !== 'string') {
      console.error('Style image queue message rejected:', 'background_payload_invalid');
      return;
    }
    await worker({ body: JSON.stringify(message) });
  };
}

const queue = new QueueClient();

export default queue.handleNodeCallback(
  createStyleImageQueueMessageHandler(),
  { visibilityTimeoutSeconds: 300 },
);
