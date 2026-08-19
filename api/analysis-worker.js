import { QueueClient } from '@vercel/queue';
import { createBackgroundAnalysisHandler } from '../lib/background-analysis-worker.js';

export function createAnalysisQueueMessageHandler(dependencies = {}) {
  const worker = dependencies.worker || createBackgroundAnalysisHandler();
  return async function handleAnalysisQueueMessage(message) {
    if (!message || typeof message.workerToken !== 'string') {
      console.error('Analysis queue message rejected:', 'background_payload_invalid');
      return;
    }
    await worker({ body: JSON.stringify(message) });
  };
}

const queue = new QueueClient();

export default queue.handleNodeCallback(
  createAnalysisQueueMessageHandler(),
  { visibilityTimeoutSeconds: 120 },
);
