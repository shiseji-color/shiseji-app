import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import analysisStatusHandler from '../api/analysis-status.js';
import verifyCodeHandler from '../api/verify-code.js';
import {
  createAnalysisJob,
  getAnalysisJob,
} from '../lib/activation-store.js';
import {
  createAnalysisJobToken,
  createAnalysisWorkerToken,
  verifyAnalysisToken,
} from '../lib/analysis-token.js';
import { createBackgroundAnalysisHandler } from '../lib/background-analysis-worker.js';
import { assertStagingTarget } from '../lib/staging-guard.js';
import {
  deleteTemporaryPhoto,
  downloadTemporaryPhoto,
  temporaryPhotoPath,
  uploadTemporaryPhoto,
} from '../lib/temporary-photo-store.js';

const TEST_IMAGE_PATH = new URL('../虚拟测试正面照.png', import.meta.url);
const TEST_CODE_PATH = new URL('../private/test-activation-code.txt', import.meta.url);

function requireSafeEnvironment() {
  const projectRef = assertStagingTarget(process.env.SUPABASE_URL);
  if (process.env.STYLE_IMAGE_GENERATION_ENABLED !== 'false') {
    throw new Error('安全拦截：预发布验收必须关闭造型图生成。');
  }
  if (!process.env.API_KEY || !process.env.AUTH_TOKEN_SECRET) {
    throw new Error('预发布模型或签名配置不完整。');
  }
  return projectRef;
}

function createResponseCapture() {
  const captured = { statusCode: 200, headers: {}, body: null };
  return {
    captured,
    response: {
      setHeader(name, value) { captured.headers[name] = value; },
      status(code) { captured.statusCode = code; return this; },
      json(body) { captured.body = body; return this; },
    },
  };
}

async function invoke(handler, body, route) {
  const { captured, response } = createResponseCapture();
  await handler({
    method: 'POST',
    body,
    headers: { 'x-forwarded-for': '127.0.0.1' },
    socket: { remoteAddress: '127.0.0.1' },
  }, response);
  if (captured.statusCode >= 400) {
    throw new Error(`${route} failed with HTTP ${captured.statusCode}`);
  }
  return captured.body;
}

async function readTestCode() {
  const contents = await readFile(TEST_CODE_PATH, 'utf8');
  const code = contents.match(/\bTST-[A-Z2-9]{8}\b/)?.[0];
  if (!code) throw new Error('测试激活码文件无有效测试码。');
  return code;
}

async function temporaryPhotoWasDeleted(photoPath) {
  try {
    await downloadTemporaryPhoto(photoPath);
    return false;
  } catch {
    return true;
  }
}

async function main() {
  const projectRef = requireSafeEnvironment();
  const activationCode = await readTestCode();
  const image = await readFile(TEST_IMAGE_PATH);
  const requestId = randomUUID();
  let photoPath;

  try {
    const verification = await invoke(
      verifyCodeHandler,
      { activationCode },
      'verify-code',
    );
    if (!verification?.valid || !verification.analysisToken) {
      throw new Error('测试激活码无效或次数已用完。');
    }

    const codeHash = verifyAnalysisToken(verification.analysisToken);
    const proposed = { taskId: randomUUID(), ownerId: randomUUID() };
    photoPath = temporaryPhotoPath(proposed.taskId, proposed.ownerId, 'image/png');
    const job = await createAnalysisJob(
      codeHash,
      requestId,
      proposed.taskId,
      proposed.ownerId,
      photoPath,
    );
    if (!job) throw new Error('无法创建预发布分析任务。');

    const claims = {
      codeHash,
      requestId,
      taskId: job.taskId,
      ownerId: job.ownerId,
    };
    photoPath = job.photoPath;
    await uploadTemporaryPhoto(photoPath, {
      buffer: image,
      contentType: 'image/png',
    });

    const worker = createBackgroundAnalysisHandler();
    await worker({
      body: JSON.stringify({
        workerToken: createAnalysisWorkerToken({ ...claims, photoPath }),
      }),
    });

    const statusPayload = await invoke(
      analysisStatusHandler,
      {
        taskId: claims.taskId,
        jobToken: createAnalysisJobToken(claims),
      },
      'analysis-status',
    );
    const storedJob = await getAnalysisJob(claims);
    const report = statusPayload?.data;
    const eligible = report?.season_en !== 'PHOTO_NOT_ELIGIBLE';

    if (statusPayload?.status !== 'completed' || !report) {
      throw new Error(`预发布分析未完成，最终状态为 ${statusPayload?.status || 'unknown'}。`);
    }

    const safeSummary = {
      ok: true,
      target: 'staging',
      projectRef,
      model: process.env.MODEL_NAME,
      styleImageGeneration: false,
      status: statusPayload.status,
      photoEligible: eligible,
      seasonEn: report.season_en,
      seasonName: report.season_name,
      remainingUses: statusPayload.remainingUses,
      resultFieldCount: Object.keys(report).length,
      visualTokenIssued: Boolean(statusPayload.visualToken),
      temporaryPhotoDeleted: await temporaryPhotoWasDeleted(photoPath),
      storedJobStatus: storedJob?.status || null,
    };
    console.log(JSON.stringify(safeSummary, null, 2));
  } catch (error) {
    if (photoPath) {
      try { await deleteTemporaryPhoto(photoPath); } catch {}
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(`Staging E2E failed: ${error.message}`);
  process.exitCode = 1;
});
