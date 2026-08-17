import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildImageEditorRequest,
  classifyStyleImageFailure,
} from '../api/generate-style-image.js';

const originalEnvironment = {
  apiKey: process.env.API_KEY,
  imageBaseUrl: process.env.IMAGE_BASE_URL,
};

test.afterEach(() => {
  if (originalEnvironment.apiKey === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = originalEnvironment.apiKey;
  if (originalEnvironment.imageBaseUrl === undefined) delete process.env.IMAGE_BASE_URL;
  else process.env.IMAGE_BASE_URL = originalEnvironment.imageBaseUrl;
});

test('style image diagnostics expose only fixed safe stage codes', () => {
  assert.equal(
    classifyStyleImageFailure({ diagnosticCode: 'style_image_model_request_failed' }),
    'style_image_model_request_failed',
  );
  assert.equal(
    classifyStyleImageFailure({ diagnosticCode: 'style_image_job_fail_failed' }),
    'style_image_job_fail_failed',
  );
  assert.equal(
    classifyStyleImageFailure({ diagnosticCode: 'https://secret.example/photo' }),
    'style_image_handler_failed',
  );
  assert.equal(classifyStyleImageFailure(new Error('raw provider response')), 'style_image_handler_failed');
  assert.equal(classifyStyleImageFailure('raw string'), 'style_image_handler_failed');
});

test('configuration preflight fails with a fixed code before a request can be sent', () => {
  delete process.env.API_KEY;
  delete process.env.IMAGE_BASE_URL;
  assert.throws(
    () => buildImageEditorRequest({ imageBase64: 'data:image/png;base64,AA==', kind: 'beauty', analysis: {} }),
    (error) => error.diagnosticCode === 'style_image_configuration_failed',
  );
});

test('request preflight constructs the provider payload without dispatching it', () => {
  process.env.API_KEY = 'test-only-key';
  process.env.IMAGE_BASE_URL = 'https://workspace.example/api/v1/';
  const request = buildImageEditorRequest({
    imageBase64: 'data:image/png;base64,AA==',
    kind: 'beauty',
    analysis: { season_name: '测试色彩', makeup_advice: '测试建议' },
  });
  assert.equal(
    request.endpoint,
    'https://workspace.example/api/v1/services/aigc/multimodal-generation/generation',
  );
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'qwen-image-edit-max');
  assert.equal(body.parameters.size, '960*1280');
});
